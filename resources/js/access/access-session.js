import { ACCESS_SESSION_KEY, PERMISSIONS, hasRolePolicy, normalizePermissionList, policyForRole } from './access-policy.js';
import { displayRoleName } from './role-labels.js';

function resolveSessionHome(roleName, permissions) {
    const policy = policyForRole(roleName);

    if (hasRolePolicy(roleName)) return policy.home;
    if (permissions.includes(PERMISSIONS.ROLES_MANAGE)) return '/role-management';
    if (permissions.includes(PERMISSIONS.DASHBOARD_VIEW)) return '/dashboard';
    if (permissions.includes(PERMISSIONS.PLANS_VIEW)) return '/strategic-plans';

    return '/access-denied';
}

function permissionsFromUser(user, policyPermissions) {
    // `/api/auth/me` returns `permissions` even when the role has none. Treat
    // that list as authoritative; only use the legacy role policy when an
    // older response does not include permission data at all.
    if (Array.isArray(user?.permissions)) {
        return normalizePermissionList(user.permissions);
    }

    if (Array.isArray(user?.role?.permissions)) {
        return normalizePermissionList(user.role.permissions);
    }

    return normalizePermissionList(policyPermissions);
}

export function createAccessSession(user) {
    const roleName = user?.role?.role_name || user?.role_name || '';
    const policy = policyForRole(roleName);
    const permissions = permissionsFromUser(user, policy.permissions);

    return {
        userId: user?.user_id,
        name: user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
        roleName,
        roleLabel: displayRoleName(roleName, ''),
        permissions,
        home: resolveSessionHome(roleName, permissions),
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
        const permissions = Array.isArray(stored.permissions)
            ? normalizePermissionList(stored.permissions)
            : normalizePermissionList(currentPolicy.permissions);
        return {
            ...stored,
            roleLabel: displayRoleName(stored.roleName, ''),
            permissions,
            home: resolveSessionHome(stored.roleName, permissions),
        };
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
