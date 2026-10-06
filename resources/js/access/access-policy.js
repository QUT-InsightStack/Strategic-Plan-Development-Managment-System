export const ACCESS_SESSION_KEY = 'spdms.frontend-access';

export const PERMISSIONS = Object.freeze({
    USERS_VIEW: 'users.view',
    USERS_MANAGE: 'users.manage',
    USERS_CREATE: 'users.create',
    USERS_UPDATE: 'users.update',
    USERS_DELETE: 'users.delete',
    USERS_ASSIGN_ROLES: 'users.assign_roles',
    ROLES_VIEW: 'roles.view',
    ROLES_MANAGE: 'roles.manage',
    ROLES_ASSIGN_PROTECTED: 'roles.assign_protected',
    PERMISSIONS_VIEW: 'permissions.view',
    PERMISSIONS_MANAGE: 'permissions.manage',
    PLANS_VIEW: 'strategic_records.view',
    PLANS_MANAGE: 'strategic_records.manage',
    PLANS_CREATE: 'strategic_records.create',
    PLANS_UPDATE: 'strategic_records.update',
    PLANS_DELETE: 'strategic_records.delete',
    PLANS_ARCHIVE: 'strategic_records.archive',
    OBJECTIVES_ARCHIVE: 'strategic_objectives.archive',
    OBJECTIVES_VIEW: 'strategic_objectives.view',
    INPUTS_VIEW: 'implementation_inputs.view',
    INPUTS_CREATE: 'implementation_inputs.create',
    OBJECTIVE_COMMENTS_CREATE: 'objective_comments.create',
    DOCUMENTS_UPLOAD: 'strategic_documents.upload',
    OBJECTIVES_CREATE: 'strategic_objectives.create',
    OBJECTIVES_UPDATE: 'strategic_objectives.update',
    OBJECTIVES_VIEW_PROGRESS: 'strategic_objectives.view_progress',
    OBJECTIVES_UPDATE_PROGRESS: 'strategic_objectives.update_progress',
    OBJECTIVES_CORRECT_PROGRESS: 'strategic_objectives.correct_progress',
    OBJECTIVES_DELETE: 'strategic_objectives.delete',
    FOUNDATIONS_VIEW: 'strategic_foundations.view',
    FOUNDATIONS_MANAGE: 'strategic_foundations.manage',
    MAPPINGS_MANAGE: 'relations.manage',
    REPORTS_VIEW: 'reports.view',
    LOGS_VIEW: 'logs.view',
    LOGIN_HISTORY_VIEW: 'login_history.view',
    SYSTEM_MONITORING_VIEW: 'system_monitoring.view',
    SETTINGS_MANAGE: 'settings.manage',
    DASHBOARD_VIEW: 'dashboard.view',
    PDP_CHAPTERS_MANAGE: 'pdp_chapters.manage',
    PDP_CHAPTERS_ARCHIVE: 'pdp_chapters.archive',
    PDP_CHAPTERS_DELETE: 'pdp_chapters.delete',
    PRESIDENTIAL_AGENDA_VIEW: 'presidential_agenda.view',
    PRESIDENTIAL_AGENDA_MANAGE: 'presidential_agenda.manage',
    PRESIDENTIAL_AGENDA_ARCHIVE: 'presidential_agenda.archive',
    PRESIDENTIAL_AGENDA_DELETE: 'presidential_agenda.delete',
    REFERENCE_DATA_MANAGE: 'reference_data.manage',
    TEMPLATES_MANAGE: 'templates.manage',
    MONITORING_VIEW: 'monitoring.view',
    BACKUPS_VIEW: 'backups.view',
    BACKUPS_CREATE: 'backups.create',
    BACKUPS_DOWNLOAD: 'backups.download',
    BACKUPS_RESTORE: 'backups.restore',
});

const fullPlanningPermissions = [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PLANS_VIEW,
    PERMISSIONS.PLANS_CREATE,
    PERMISSIONS.PLANS_UPDATE,
    PERMISSIONS.PLANS_ARCHIVE,
    PERMISSIONS.PLANS_DELETE,
    PERMISSIONS.FOUNDATIONS_VIEW,
    PERMISSIONS.FOUNDATIONS_MANAGE,
    PERMISSIONS.MAPPINGS_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
];

const managementPermissions = [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PLANS_VIEW,
    PERMISSIONS.FOUNDATIONS_VIEW,
    PERMISSIONS.OBJECTIVES_VIEW,
    PERMISSIONS.OBJECTIVE_COMMENTS_CREATE,
    PERMISSIONS.OBJECTIVES_VIEW_PROGRESS,
    PERMISSIONS.INPUTS_VIEW,
    'implementation_inputs.view_all',
    'relations.view',
    'plan_core_values.view',
    'strategic_documents.view',
    'strategic_documents.download',
];

const contributorPlanningPermissions = [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PLANS_VIEW,
    PERMISSIONS.PLANS_CREATE,
    PERMISSIONS.PLANS_UPDATE,
    PERMISSIONS.PLANS_ARCHIVE,
    PERMISSIONS.FOUNDATIONS_VIEW,
    PERMISSIONS.FOUNDATIONS_MANAGE,
    PERMISSIONS.MAPPINGS_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
];

const technicalAdminPermissions = [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.USERS_CREATE,
    PERMISSIONS.USERS_UPDATE,
    PERMISSIONS.USERS_DELETE,
    PERMISSIONS.USERS_ASSIGN_ROLES,
    PERMISSIONS.ROLES_VIEW,
    PERMISSIONS.ROLES_MANAGE,
    PERMISSIONS.ROLES_ASSIGN_PROTECTED,
    PERMISSIONS.PERMISSIONS_VIEW,
    PERMISSIONS.PERMISSIONS_MANAGE,
    PERMISSIONS.LOGS_VIEW,
    PERMISSIONS.LOGIN_HISTORY_VIEW,
    PERMISSIONS.SYSTEM_MONITORING_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.BACKUPS_VIEW,
    PERMISSIONS.BACKUPS_CREATE,
    PERMISSIONS.BACKUPS_DOWNLOAD,
    PERMISSIONS.BACKUPS_RESTORE,
];

const administrativeAdminPermissions = [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PRESIDENTIAL_AGENDA_VIEW,
    PERMISSIONS.PRESIDENTIAL_AGENDA_MANAGE,
    PERMISSIONS.PRESIDENTIAL_AGENDA_ARCHIVE,
    PERMISSIONS.PRESIDENTIAL_AGENDA_DELETE,
    PERMISSIONS.REFERENCE_DATA_MANAGE,
    PERMISSIONS.TEMPLATES_MANAGE,
    PERMISSIONS.PDP_CHAPTERS_MANAGE,
    PERMISSIONS.PDP_CHAPTERS_ARCHIVE,
    PERMISSIONS.PDP_CHAPTERS_DELETE,
    PERMISSIONS.MONITORING_VIEW,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.LOGS_VIEW,
];

const officePermissions = [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.PLANS_VIEW,
    PERMISSIONS.OBJECTIVES_VIEW, PERMISSIONS.OBJECTIVES_UPDATE,
    PERMISSIONS.OBJECTIVES_VIEW_PROGRESS, PERMISSIONS.OBJECTIVES_UPDATE_PROGRESS,
    PERMISSIONS.INPUTS_CREATE, PERMISSIONS.OBJECTIVE_COMMENTS_CREATE, PERMISSIONS.DOCUMENTS_UPLOAD,
    PERMISSIONS.FOUNDATIONS_VIEW, 'relations.view', 'relations.create', PERMISSIONS.REPORTS_VIEW];

const rolePolicies = {
    Administrator: { home: '/role-management', permissions: ['*'] },
    'Administrative Admin': { home: '/dashboard', permissions: administrativeAdminPermissions },
    'Administrative Administrator': { home: '/dashboard', permissions: administrativeAdminPermissions },
    'Technical Administrator': { home: '/dashboard', permissions: technicalAdminPermissions },
    'Technical Admin': { home: '/dashboard', permissions: technicalAdminPermissions },
    test: { home: '/dashboard', permissions: ['*'] },
    'Planning Officer': { home: '/strategic-plans', permissions: contributorPlanningPermissions },
    'Planner/Encoder': { home: '/strategic-plans', permissions: contributorPlanningPermissions },
    Office: { home: '/office', permissions: officePermissions },
    'Office Representative': { home: '/office', permissions: officePermissions },
    'Office/Agency': { home: '/office', permissions: officePermissions },
    'Offices / Agencies': { home: '/office', permissions: officePermissions },
    'Responsible Unit User': { home: '/office', permissions: officePermissions },
    'Division Head': { home: '/strategic-plans', permissions: fullPlanningPermissions },
    Management: { home: '/management-dashboard', permissions: managementPermissions },
    Executive: { home: '/management-dashboard', permissions: managementPermissions },
    'Management / Executive': { home: '/management-dashboard', permissions: managementPermissions },
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

export function hasRolePolicy(roleName) {
    return Object.prototype.hasOwnProperty.call(rolePolicies, roleName);
}

export const routeRules = [
    { test: /^\/management-dashboard(?:\/|$)/, permission: PERMISSIONS.DASHBOARD_VIEW },
    { test: /^\/management-approvals(?:\/|$)/, permission: PERMISSIONS.PLANS_VIEW },
    { test: /^\/management-plan-review(?:\/|$)/, permission: PERMISSIONS.PLANS_VIEW },
    { test: /^\/progress-monitoring(?:\/|$)/, permission: PERMISSIONS.OBJECTIVES_VIEW_PROGRESS },
    { test: /^\/strategic-plans\/\d+\/approval-status(?:\/|$)/ },
    { test: /^\/consolidate-inputs(?:\/|$)/, permission: PERMISSIONS.INPUTS_VIEW },
    { test: /^\/office(?:\/|$)/, permission: PERMISSIONS.PLANS_VIEW },
    {
    test: /^\/workflow-configuration(?:\/|$)/,
    roles: ['Administrator', 'Technical Administrator', 'Technical Admin', 'test'],
},
    { test: /^\/administrative-admin\/reference-data(?:\/|$)/, permission: PERMISSIONS.REFERENCE_DATA_MANAGE },
    { test: /^\/administrative-admin\/templates(?:\/|$)/, permission: PERMISSIONS.TEMPLATES_MANAGE },
    { test: /^\/dashboard(?:\/|$)/, permission: PERMISSIONS.DASHBOARD_VIEW },
    { test: /^\/settings(?:\/|$)/, permission: PERMISSIONS.SETTINGS_MANAGE },
    { test: /^\/role-management(?:\/|$)/, permission: PERMISSIONS.ROLES_MANAGE },
    { test: /^\/user-management(?:\/|$)/, permission: PERMISSIONS.USERS_VIEW },
    { test: /^\/pdp-chapters\/manage(?:\/|$)/, permission: PERMISSIONS.PDP_CHAPTERS_MANAGE },
    { test: /^\/login-history(?:\/|$)/, permission: PERMISSIONS.LOGIN_HISTORY_VIEW },
    { test: /^\/audit-logs(?:\/|$)/, permission: PERMISSIONS.LOGS_VIEW },
    { test: /^\/system-monitoring(?:\/|$)/, permission: PERMISSIONS.SYSTEM_MONITORING_VIEW },

    { test: /^\/manual-backup(?:\/|$)/, permission: PERMISSIONS.BACKUPS_VIEW },

// Review access is checked against recorded workflow participants by the API.
{
    test: /^\/strategic-plan-reviews(?:\/|$)/,
},

{ test: /^\/strategic-plans\/create(?:\/|$)/, permission: PERMISSIONS.PLANS_CREATE },
{ test: /^\/strategic-plans\/\d+\/edit(?:\/|$)/, permission: PERMISSIONS.PLANS_UPDATE },
{ test: /^\/strategic-(?:plans|objectives)(?:\/|$)/, permission: PERMISSIONS.PLANS_VIEW },
];
