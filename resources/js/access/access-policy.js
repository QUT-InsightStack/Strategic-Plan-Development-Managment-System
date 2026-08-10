export const ACCESS_SESSION_KEY = 'spdms.frontend-access';

export const PERMISSIONS = Object.freeze({
    USERS_VIEW: 'users.view',
    USERS_MANAGE: 'users.manage',
    ROLES_VIEW: 'roles.view',
    ROLES_MANAGE: 'roles.manage',
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
});

const rolePolicies = {
    Administrator: { home: '/role-management', permissions: ['*'] },
    'Technical Administrator': { home: '/role-management', permissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_VIEW, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.PERMISSIONS_VIEW, PERMISSIONS.PERMISSIONS_MANAGE, PERMISSIONS.LOGS_VIEW, PERMISSIONS.SETTINGS_MANAGE] },
    'Planning Officer': { home: '/strategic-plans', permissions: [PERMISSIONS.PLANS_VIEW, PERMISSIONS.PLANS_MANAGE, PERMISSIONS.FOUNDATIONS_VIEW, PERMISSIONS.FOUNDATIONS_MANAGE, PERMISSIONS.MAPPINGS_MANAGE, PERMISSIONS.REPORTS_VIEW] },
    'Planner/Encoder': { home: '/strategic-plans', permissions: [PERMISSIONS.PLANS_VIEW, PERMISSIONS.PLANS_MANAGE, PERMISSIONS.FOUNDATIONS_VIEW, PERMISSIONS.FOUNDATIONS_MANAGE, PERMISSIONS.REPORTS_VIEW] },
    'Division Head': { home: '/strategic-plans', permissions: [PERMISSIONS.PLANS_VIEW, PERMISSIONS.REPORTS_VIEW] },
    Viewer: { home: '/strategic-plans', permissions: [PERMISSIONS.PLANS_VIEW, PERMISSIONS.REPORTS_VIEW] },
};

export function policyForRole(roleName) {
    return rolePolicies[roleName] || { home: '/access-denied', permissions: [] };
}

export const routeRules = [
    { test: /^\/dashboard(?:\/|$)/, permission: PERMISSIONS.DASHBOARD_VIEW },
    { test: /^\/role-management(?:\/|$)/, permission: PERMISSIONS.ROLES_MANAGE },
    { test: /^\/strategic-plans\/create(?:\/|$)/, permission: PERMISSIONS.PLANS_MANAGE },
    { test: /^\/strategic-plans\/\d+\/edit(?:\/|$)/, permission: PERMISSIONS.PLANS_MANAGE },
    { test: /^\/strategic-(?:plans|objectives)(?:\/|$)/, permission: PERMISSIONS.PLANS_VIEW },
];
