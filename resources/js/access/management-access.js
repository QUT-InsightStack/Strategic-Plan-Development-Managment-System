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

/**
 * A plan's current approval stage is actionable only by the approver the
 * active workflow assigned to it. Approvers can be configured by role, user,
 * office or unit, so each is matched against the matching session field.
 */
export function isAssignedApprover(stage, session) {
    if (!stage || !session || stage.status !== 'pending') return false;
    if (session.permissions?.includes('*')) return true;

    const approver = String(stage.approver || '').trim().toLocaleLowerCase();
    if (!approver) return false;

    const candidates = {
        role: [session.roleName, displayRoleName(session.roleName, '')],
        user: [session.name],
        office: [session.office],
        unit: [session.office],
    }[stage.approverType] || [];

    return candidates.some((value) => String(value || '').trim().toLocaleLowerCase() === approver);
}
