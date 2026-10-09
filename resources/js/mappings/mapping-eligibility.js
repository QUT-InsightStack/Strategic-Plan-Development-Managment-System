import { displayRoleName } from '../access/role-labels.js';

/*
 * Whether a Strategic Plan currently allows its alignment mappings to be
 * archived or restored.
 *
 * Only draft, not-submitted plans allow alignment changes. Returns a
 * user-facing reason when changes are locked, or null when they are allowed.
 */
const LOCKED_APPROVAL_STATUSES = {
    under_approval: 'This plan has been submitted and is under approval, so its mappings are locked.',
    approved: 'This plan has been approved, so its mappings are locked.',
};

export function mappingChangeLockReason(plan) {
    if (!plan) return 'Select a Strategic Plan first.';
    if (LOCKED_APPROVAL_STATUSES[plan.approval_status]) return LOCKED_APPROVAL_STATUSES[plan.approval_status];
    if (plan.status === 'archived') return 'This plan is archived. Restore the plan before changing its mappings.';
    if (plan.status !== 'draft') return 'This plan has been finalised, so its mappings are locked.';
    if (plan.approval_status !== 'not_submitted') return 'This plan approval state does not allow mapping changes.';
    return null;
}

/** An individual mapping can be archived only while it is active. */
export function mappingArchiveBlockReason(mapping, plan) {
    if (!mapping) return 'This mapping no longer exists.';
    if (mapping.status !== 'active') return 'This mapping is already archived.';
    return mappingChangeLockReason(plan);
}

/*
 * Permanent deletion is limited to Management users and Technical
 * Administrators (SPDM-42). Planning Officers and Office/Agency users archive
 * instead, even if a role were given relations.delete by mistake. The server
 * still makes the final authorisation decision.
 */
const DELETE_ROLES = ['Management', 'Technical Administrator', 'Administrator', 'test'];
const NEVER_DELETE_ROLE_LABELS = ['Planning Officer', 'Office/Agency'];

export function canDeleteMappings(session) {
    if (!session) return false;
    const label = displayRoleName(session.roleName, '');
    if (NEVER_DELETE_ROLE_LABELS.includes(label)) return false;
    return DELETE_ROLES.includes(session.roleName)
        && Boolean(session.permissions?.some(code => ['*', 'strategic_alignments.delete'].includes(code)));
}

/*
 * Only active mappings on draft plans can be permanently deleted. Archived
 * mappings are historical records, and mappings on finalised or approval
 * plans are part of the submitted record, so both must be kept.
 */
export function mappingDeleteBlockReason(mapping, plan) {
    if (!mapping) return 'This mapping no longer exists.';
    if (mapping.status === 'archived') return 'Archived mappings are kept as historical records and cannot be permanently deleted.';
    const locked = mappingChangeLockReason(plan);
    return locked ? `${locked} It must be kept as part of the plan record.` : null;
}
