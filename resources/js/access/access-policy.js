export const ACCESS_SESSION_KEY = 'spdms.frontend-access';

export const PERMISSIONS = Object.freeze({
    USERS_VIEW: 'users.view',
    USERS_MANAGE: 'users.manage',
    USERS_CREATE: 'users.create',
    USERS_UPDATE: 'users.update',
    USERS_ASSIGN_ROLES: 'users.assign_roles',
    ROLES_VIEW: 'roles.view',
    ROLES_MANAGE: 'roles.manage',
    ROLES_ASSIGN_PROTECTED: 'roles.assign_protected',
    PERMISSIONS_VIEW: 'permissions.view',
    PERMISSIONS_MANAGE: 'permissions.manage',
    PLANS_VIEW: 'strategic_records.view',
    PLANS_MANAGE: 'strategic_records.manage',
    FOUNDATIONS_VIEW: 'strategic_foundations.view',
    FOUNDATIONS_MANAGE: 'strategic_foundations.manage',
    MAPPINGS_MANAGE: 'relations.manage',
    REPORTS_VIEW: 'reports.view',
    LOGS_VIEW: 'logs.view',
    SETTINGS_MANAGE: 'settings.manage',
    DASHBOARD_VIEW: 'dashboard.view',
    PDP_CHAPTERS_MANAGE: 'pdp_chapters.manage',
});

const rolePolicies = {
    Administrator: { home: '/role-management', permissions: ['*'] },
    'Technical Administrator': { home: '/role-management', permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_VIEW, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.PERMISSIONS_VIEW, PERMISSIONS.PERMISSIONS_MANAGE, PERMISSIONS.LOGS_VIEW, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.PDP_CHAPTERS_MANAGE] },
    'Planning Officer': { home: '/strategic-plans', permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.PLANS_VIEW, PERMISSIONS.PLANS_MANAGE, PERMISSIONS.FOUNDATIONS_VIEW, PERMISSIONS.FOUNDATIONS_MANAGE, PERMISSIONS.MAPPINGS_MANAGE, PERMISSIONS.REPORTS_VIEW] },
    'Planner/Encoder': { home: '/strategic-plans', permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.PLANS_VIEW, PERMISSIONS.PLANS_MANAGE, PERMISSIONS.FOUNDATIONS_VIEW, PERMISSIONS.FOUNDATIONS_MANAGE, PERMISSIONS.REPORTS_VIEW] },
    'Division Head': { home: '/strategic-plans', permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.PLANS_VIEW, PERMISSIONS.REPORTS_VIEW] },
    Viewer: { home: '/strategic-plans', permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.PLANS_VIEW, PERMISSIONS.REPORTS_VIEW] },
};

export function normalizePermissionList(list) {
    if (!Array.isArray(list)) return [];

    return list
        .map((permission) => typeof permission === 'string' ? permission : permission?.code)
        .filter(Boolean);
}

export function policyForRole(roleName) {
    return rolePolicies[roleName] || { home: '/access-denied', permissions: [] };
}

export const routeRules = [
    { test: /^\/dashboard(?:\/|$)/, permission: PERMISSIONS.DASHBOARD_VIEW },
    { test: /^\/role-management(?:\/|$)/, permission: PERMISSIONS.ROLES_MANAGE },
    { test: /^\/user-management(?:\/|$)/, permission: PERMISSIONS.USERS_VIEW },
    { test: /^\/pdp-chapters\/manage(?:\/|$)/, permission: PERMISSIONS.PDP_CHAPTERS_MANAGE },
    { test: /^\/login-history(?:\/|$)/, permission: PERMISSIONS.LOGS_VIEW },
    { test: /^\/strategic-plans\/create(?:\/|$)/, permission: PERMISSIONS.PLANS_MANAGE },
    { test: /^\/strategic-plans\/\d+\/edit(?:\/|$)/, permission: PERMISSIONS.PLANS_MANAGE },
    { test: /^\/strategic-(?:plans|objectives)(?:\/|$)/, permission: PERMISSIONS.PLANS_VIEW },
];
