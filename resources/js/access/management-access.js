import { PERMISSIONS } from './access-policy.js';
import { can } from './access-session.js';
import { displayRoleName } from './role-labels.js';

/*
 * Management levels recognised by the Management dashboard.
 *
 * The level only decides how the dashboard describes the viewer's scope.
 * Which plans and objectives the viewer can see is decided by the API
 * (it already returns only records within the user's authorised scope), so
 * nothing here widens access.
 */
const MANAGEMENT_ROLE_LEVELS = Object.freeze({
    Management: 'Management',
    Executive: 'Executive',
    'Management / Executive': 'Executive',
    'Division Head': 'Division',
});

// Granting this permission lets a role use the dashboard without being added
// to the list above, so access can be configured rather than hardcoded.
export const MANAGEMENT_DASHBOARD_PERMISSION = 'management_dashboard.view';

export function managementLevel(session) {
    if (!session) return null;
    if (MANAGEMENT_ROLE_LEVELS[session.roleName]) return MANAGEMENT_ROLE_LEVELS[session.roleName];
    if (session.permissions?.includes('*')) return 'Administrator';
    if (session.permissions?.includes(MANAGEMENT_DASHBOARD_PERMISSION)) return displayRoleName(session.roleName, 'Management');
    return null;
}

export function isManagementSession(session) {
    return Boolean(managementLevel(session)) && can(PERMISSIONS.DASHBOARD_VIEW, session);
}
