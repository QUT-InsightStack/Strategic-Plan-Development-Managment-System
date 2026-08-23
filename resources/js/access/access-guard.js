import { routeRules } from './access-policy.js';
import { can, getAccessSession } from './access-session.js';

export function enforcePageAccess(pathname = window.location.pathname) {
    const session = getAccessSession();
    if (!session) {
        window.location.replace('/login');
        return false;
    }
    const rule = routeRules.find((candidate) => candidate.test.test(pathname));
    if (rule && !can(rule.permission, session)) {
        window.location.replace('/access-denied');
        return false;
    }
    return true;
}
