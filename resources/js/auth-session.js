/**
 * Shared session termination for authenticated pages.
 *
 * Every page previously carried its own logout handler and they had drifted:
 * some cleared localStorage, some cleared nothing, none showed a loading
 * state. This module is the single implementation they all call.
 */

const loginUrl = '/login';
const logoutApiUrl = '/api/auth/logout';

/**
 * Keys written by the sign in flow. Removed on logout so no authentication
 * information is left behind in the browser.
 *
 * Note: the JWT itself lives in an HttpOnly cookie which JavaScript cannot
 * touch by design. The server clears it via an expired Set-Cookie header on
 * the logout response, so the request must be allowed to complete.
 */
const AUTH_STORAGE_KEYS = ['auth_token', 'spms.rememberedAccount'];

/**
 * Remove authentication data held in the browser.
 *
 * `spms.rememberedEmail` is deliberately preserved: it backs the "Remember
 * Me" checkbox and is a stored preference, not a credential. Clearing it on
 * logout would silently break that feature.
 */
export function clearAuthStorage() {
    AUTH_STORAGE_KEYS.forEach((key) => {
        try {
            window.localStorage.removeItem(key);
            window.sessionStorage.removeItem(key);
        } catch (error) {
            // Storage can throw in private browsing modes. Nothing to
            // recover here, and logout must continue regardless.
        }
    });
}

/**
 * Prevent the browser restoring this page from its back/forward cache after
 * the session has ended.
 *
 * A bfcache restore replays the DOM as it was, bypassing any load-time auth
 * check, so a logged out user can appear to still be signed in. `pageshow`
 * with `persisted` is the only reliable signal that this happened.
 *
 * Call once when an authenticated page mounts.
 */
export function guardAgainstBackNavigation() {
    window.addEventListener('pageshow', (event) => {
        if (event.persisted && wasLoggedOut()) {
            window.location.replace(loginUrl);
        }
    });
}

const LOGOUT_FLAG = 'spms.loggedOut';
const LOGOUT_NOTICE_KEY = 'spms.logoutNotice';
const LOGOUT_REASONS = ['manual', 'inactivity'];

/**
 * Leave a one-time note for the login page explaining why the user is there,
 * so it can confirm the sign out rather than showing a blank form.
 */
function rememberLogoutNotice(reason, serverReached) {
    try {
        window.sessionStorage.setItem(LOGOUT_NOTICE_KEY, JSON.stringify({
            reason: LOGOUT_REASONS.includes(reason) ? reason : 'manual',
            serverReached: Boolean(serverReached),
        }));
    } catch (error) {
        // Non-fatal; the login page simply shows no confirmation.
    }
}

/**
 * Read and clear the note left by the last logout. Returns null when there is
 * none, so a later visit to the login page does not repeat it.
 */
export function readLogoutNotice() {
    try {
        const raw = window.sessionStorage.getItem(LOGOUT_NOTICE_KEY);
        window.sessionStorage.removeItem(LOGOUT_NOTICE_KEY);
        const notice = raw ? JSON.parse(raw) : null;
        return notice && LOGOUT_REASONS.includes(notice.reason) ? notice : null;
    } catch (error) {
        return null;
    }
}

function markLoggedOut() {
    try {
        window.sessionStorage.setItem(LOGOUT_FLAG, '1');
    } catch (error) {
        // Non-fatal; the server-side token invalidation still stands.
    }
}

function wasLoggedOut() {
    try {
        return window.sessionStorage.getItem(LOGOUT_FLAG) === '1';
    } catch (error) {
        return false;
    }
}

/**
 * Clear the logged-out marker. Called by the login page so a fresh sign in
 * does not immediately bounce the user back out.
 */
export function clearLogoutFlag() {
    try {
        window.sessionStorage.removeItem(LOGOUT_FLAG);
    } catch (error) {
        // Ignore.
    }
}

/**
 * Terminate the session and redirect to the login page.
 *
 * The redirect uses `location.replace` so the authenticated page is dropped
 * from history and the Back button cannot return to it.
 *
 * Resolves only if the redirect somehow does not occur; callers should treat
 * this as fire-and-forget and use `onStart` to show a loading state.
 *
 * `reason` is shown on the login page: 'manual' when the user chose to log
 * out, 'inactivity' when the session timed out.
 *
 * @param {{ onStart?: () => void, onError?: (message: string) => void, reason?: 'manual' | 'inactivity' }} handlers
 */
export async function logout({ onStart, onError, reason = 'manual' } = {}) {
    if (typeof onStart === 'function') {
        onStart();
    }

    let serverReached = true;

    try {
        await fetch(logoutApiUrl, {
            method: 'POST',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        });
    } catch (error) {
        // Network failure. The token may still be live server-side, but
        // there is nothing the client can do about that; clearing local
        // state and returning to login is the safest available outcome.
        serverReached = false;
        if (typeof onError === 'function') {
            onError('Network error during logout. Clearing local session.');
        }
    }

    clearAuthStorage();
    clearAccessSession();
    markLoggedOut();
    rememberLogoutNotice(reason, serverReached);

    window.location.replace(loginUrl);
}
import { clearAccessSession } from './access/access-session.js';
