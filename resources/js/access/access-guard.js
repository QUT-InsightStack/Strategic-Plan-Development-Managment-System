import { routeRules } from './access-policy.js';
import { can, createAccessSession, getAccessSession, saveAccessSession } from './access-session.js';
import { startSessionTimeout } from '../session-timeout.js';
import { getCurrentUser } from '../api/auth-api.js';

let recoveryStarted = false;

function recoverAccessSession(pathname) {
    if (recoveryStarted) return;
    recoveryStarted = true;

    getCurrentUser()
        .then((payload) => {
            if (!payload.data) throw new Error('Unauthenticated');

            const session = saveAccessSession(createAccessSession(payload.data));
            const rule = routeRules.find((candidate) => candidate.test.test(pathname));

            if (rule && !can(rule.permission, session)) {
                window.location.replace('/access-denied');
                return;
            }

            window.location.reload();
        })
        .catch(() => window.location.replace('/login'));
}

export function enforcePageAccess(pathname = window.location.pathname) {
    const session = getAccessSession();
    if (!session) {
        recoverAccessSession(pathname);
        return false;
    }
    const rule = routeRules.find((candidate) => candidate.test.test(pathname));
    if (rule && !can(rule.permission, session)) {
        window.location.replace('/access-denied');
        return false;
    }

    // Every authenticated page funnels through here, so this is the single
    // place the inactivity watcher needs to start.
    startSessionTimeout();

    return true;
}
