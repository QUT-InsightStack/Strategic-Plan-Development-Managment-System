import { routeRules } from './access-policy.js';
import { can, createAccessSession, getAccessSession, saveAccessSession } from './access-session.js';

let recoveryStarted = false;

function recoverAccessSession(pathname) {
    if (recoveryStarted) return;
    recoveryStarted = true;

    fetch('/api/auth/me', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    })
        .then(async (response) => {
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.data) throw new Error('Unauthenticated');

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
    return true;
}
