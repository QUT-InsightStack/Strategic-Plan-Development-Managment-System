import { ACCESS_SESSION_KEY, policyForRole } from './access-policy.js';

export function createAccessSession(user) {
    const roleName = user?.role?.role_name || user?.role_name || '';
    const policy = policyForRole(roleName);
    return { userId: user?.user_id, name: user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim(), roleName, permissions: policy.permissions, home: policy.home };
}

export function saveAccessSession(session) {
    window.sessionStorage.setItem(ACCESS_SESSION_KEY, JSON.stringify(session));
    return session;
}

export function getAccessSession() {
    try {
        const stored = JSON.parse(window.sessionStorage.getItem(ACCESS_SESSION_KEY)) || null;
        if (!stored) return null;
        const currentPolicy = policyForRole(stored.roleName);
        return { ...stored, permissions: currentPolicy.permissions, home: currentPolicy.home };
    }
    catch { return null; }
}

export function clearAccessSession() { window.sessionStorage.removeItem(ACCESS_SESSION_KEY); }

export function can(permission, session = getAccessSession()) {
    return Boolean(session && (session.permissions?.includes('*') || session.permissions?.includes(permission)));
}
