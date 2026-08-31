import { ACCESS_SESSION_KEY, normalizePermissionList, policyForRole } from './access-policy.js';

export function createAccessSession(user) {
    const roleName = user?.role?.role_name || user?.role_name || '';
    const policy = policyForRole(roleName);
    const permissions = normalizePermissionList(user?.permissions || user?.role?.permissions || policy.permissions);

    return {
        userId: user?.user_id,
        name: user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
        roleName,
        permissions,
        home: policy.home,
    };
}

export function saveAccessSession(session) {
    window.sessionStorage.setItem(ACCESS_SESSION_KEY, JSON.stringify(session));
    window.localStorage.setItem(ACCESS_SESSION_KEY, JSON.stringify(session));
    return session;
}

export function getAccessSession() {
    try {
        const serialized = window.sessionStorage.getItem(ACCESS_SESSION_KEY)
            || window.localStorage.getItem(ACCESS_SESSION_KEY);
        const stored = JSON.parse(serialized) || null;
        if (!stored) return null;

        // Restore the tab-scoped copy when this session came from local
        // storage, for example after opening the application in a new tab.
        window.sessionStorage.setItem(ACCESS_SESSION_KEY, JSON.stringify(stored));
        const currentPolicy = policyForRole(stored.roleName);
        return { ...stored, permissions: currentPolicy.permissions, home: currentPolicy.home };
    }
    catch { return null; }
}

export function clearAccessSession() {
    window.sessionStorage.removeItem(ACCESS_SESSION_KEY);
    window.localStorage.removeItem(ACCESS_SESSION_KEY);
}

export function can(permission, session = getAccessSession()) {
    return Boolean(session && (session.permissions?.includes('*') || session.permissions?.includes(permission)));
}
