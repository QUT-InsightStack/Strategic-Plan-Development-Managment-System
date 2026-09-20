import { getCurrentUser } from './api/auth-api.js';
import { getSecuritySettings } from './api/security-settings-api.js';

/**
 * Idle session timeout.
 *
 * Signs a user out after a period without interaction and warns them shortly
 * beforehand so work is not lost silently.
 *
 * Activity is shared between tabs through localStorage: interacting with any
 * open tab keeps every other tab alive, which matches how a user perceives
 * "using the system". A tab left open on its own still expires.
 *
 * The warning is rendered directly into the DOM rather than through the shared
 * dialog component because this module runs on every authenticated page, and
 * `components/dialog.css` is only imported by some page stylesheets. Styles are
 * injected alongside it so the warning looks the same everywhere.
 */

import { logout } from './auth-session.js';

/**
 * Mirrors SecuritySettingsService::DEFAULTS. Used when the configured value
 * cannot be read - see resolveTimeoutMinutes below.
 */
const DEFAULT_TIMEOUT_MINUTES = 30;

/** How long before expiry the warning appears. */
const WARNING_LEAD_SECONDS = 120;

/** Shared across tabs, so activity anywhere keeps the session alive. */
const ACTIVITY_KEY = 'spms.lastActivity';

const POLL_INTERVAL_MS = 1000;

/** Writes to storage are throttled to at most one per second. */
const ACTIVITY_WRITE_THROTTLE_MS = 1000;

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'focus'];

const STYLE_ELEMENT_ID = 'spms-session-timeout-styles';

let started = false;
let timeoutMs = DEFAULT_TIMEOUT_MINUTES * 60 * 1000;
let pollTimer = null;
let lastActivityWrite = 0;
let warningElement = null;
let expiring = false;

/**
 * Fallback for when localStorage is unavailable. Keeps the timeout working in
 * private browsing modes, at the cost of not being shared between tabs.
 */
let memoryLastActivity = 0;

function now() {
    return Date.now();
}

function readLastActivity() {
    try {
        const stored = Number(window.localStorage.getItem(ACTIVITY_KEY));
        if (Number.isFinite(stored) && stored > 0) return stored;
    } catch (error) {
        // Storage is unavailable in some private browsing modes; fall through
        // to the in-memory value so the timeout still applies.
    }

    return memoryLastActivity > 0 ? memoryLastActivity : null;
}

function writeLastActivity(timestamp) {
    memoryLastActivity = timestamp;

    try {
        window.localStorage.setItem(ACTIVITY_KEY, String(timestamp));
    } catch (error) {
        // Non-fatal: the in-memory value above still drives the timer.
    }
}

/**
 * Record interaction. Throttled because scroll and mousemove-adjacent events
 * fire far more often than the one second resolution this needs.
 */
function recordActivity() {
    const timestamp = now();
    if (timestamp - lastActivityWrite < ACTIVITY_WRITE_THROTTLE_MS) return;

    lastActivityWrite = timestamp;
    writeLastActivity(timestamp);
}

/**
 * Read the configured timeout.
 *
 * Only a Technical Administrator may read /api/security-settings, so for every
 * other role this falls back to the documented default. Exposing the value to
 * all authenticated users requires a backend change and is tracked separately.
 */
async function resolveTimeoutMinutes() {
    try {
        const payload = await getSecuritySettings();
        const minutes = Number(payload?.data?.session_timeout_minutes);

        return Number.isInteger(minutes) && minutes > 0 ? minutes : DEFAULT_TIMEOUT_MINUTES;
    } catch (error) {
        return DEFAULT_TIMEOUT_MINUTES;
    }
}

function injectStyles() {
    if (document.getElementById(STYLE_ELEMENT_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ELEMENT_ID;
    style.textContent = `
.spms-session-backdrop {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(15, 23, 42, 0.55);
}
.spms-session-dialog {
    width: min(420px, 100%);
    padding: 24px;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28);
    font-family: inherit;
    text-align: center;
}
.spms-session-dialog h2 {
    margin: 0 0 8px;
    font-size: 18px;
    color: #b42318;
}
.spms-session-dialog p {
    margin: 0 0 8px;
    font-size: 13px;
    line-height: 1.5;
    color: #475467;
}
.spms-session-countdown {
    display: block;
    margin-bottom: 16px;
    font-size: 26px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: #101828;
}
.spms-session-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
}
.spms-session-actions button {
    padding: 9px 16px;
    border-radius: 8px;
    border: 1px solid transparent;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
}
.spms-session-stay {
    border-color: #175cd3;
    background: #175cd3;
    color: #fff;
}
.spms-session-stay:hover { background: #1349a8; }
.spms-session-logout {
    border-color: #d0d5dd;
    background: #fff;
    color: #344054;
}
.spms-session-logout:hover { background: #f2f4f7; }
`;

    document.head.appendChild(style);
}

function buildWarning() {
    injectStyles();

    const backdrop = document.createElement('div');
    backdrop.className = 'spms-session-backdrop';
    backdrop.setAttribute('role', 'alertdialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'spms-session-title');
    backdrop.setAttribute('aria-describedby', 'spms-session-description');

    const dialog = document.createElement('div');
    dialog.className = 'spms-session-dialog';

    const title = document.createElement('h2');
    title.id = 'spms-session-title';
    title.textContent = 'Your session is about to expire';

    const description = document.createElement('p');
    description.id = 'spms-session-description';
    description.textContent = 'You have been inactive, so you will be signed out automatically and returned to the login page. Save any work in progress now.';

    const countdown = document.createElement('strong');
    countdown.className = 'spms-session-countdown';
    countdown.setAttribute('aria-live', 'assertive');

    const actions = document.createElement('div');
    actions.className = 'spms-session-actions';

    const stay = document.createElement('button');
    stay.type = 'button';
    stay.className = 'spms-session-stay';
    stay.textContent = 'Stay Signed In';
    stay.addEventListener('click', () => {
        // Touch an authenticated endpoint so the server-side token is exercised
        // at the same moment the client clock is reset.
        getCurrentUser().catch(() => {});
        lastActivityWrite = 0;
        recordActivity();
        hideWarning();
    });

    const signOut = document.createElement('button');
    signOut.type = 'button';
    signOut.className = 'spms-session-logout';
    signOut.textContent = 'Log Out Now';
    signOut.addEventListener('click', () => expire());

    actions.append(stay, signOut);
    dialog.append(title, description, countdown, actions);
    backdrop.append(dialog);

    return { backdrop, countdown, stay };
}

function showWarning(secondsRemaining) {
    if (!warningElement) {
        warningElement = buildWarning();
        document.body.appendChild(warningElement.backdrop);
        warningElement.stay.focus();
    }

    const safeSeconds = Math.max(0, secondsRemaining);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;

    warningElement.countdown.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function hideWarning() {
    if (!warningElement) return;

    warningElement.backdrop.remove();
    warningElement = null;
}

function expire() {
    if (expiring) return;
    expiring = true;

    stopPolling();
    hideWarning();

    try {
        window.localStorage.removeItem(ACTIVITY_KEY);
    } catch (error) {
        // Ignore; logout clears the rest of the session regardless.
    }

    // logout() clears stored auth, invalidates the cookie server-side and
    // replaces the current history entry with the login page, so the expired
    // page cannot be reached with the Back button.
    logout();
}

function tick() {
    const lastActivity = readLastActivity();

    if (lastActivity === null) {
        recordActivity();
        return;
    }

    const idleMs = now() - lastActivity;
    const remainingMs = timeoutMs - idleMs;

    if (remainingMs <= 0) {
        expire();
        return;
    }

    if (remainingMs <= WARNING_LEAD_SECONDS * 1000) {
        showWarning(Math.ceil(remainingMs / 1000));
        return;
    }

    hideWarning();
}

function stopPolling() {
    if (pollTimer === null) return;

    window.clearInterval(pollTimer);
    pollTimer = null;
}

/**
 * Begin watching for inactivity. Safe to call more than once; only the first
 * call takes effect.
 */
export function startSessionTimeout() {
    if (started) return;
    started = true;

    ACTIVITY_EVENTS.forEach((eventName) => {
        window.addEventListener(eventName, recordActivity, { passive: true });
    });

    recordActivity();

    resolveTimeoutMinutes().then((minutes) => {
        timeoutMs = minutes * 60 * 1000;
    });

    pollTimer = window.setInterval(tick, POLL_INTERVAL_MS);
}
