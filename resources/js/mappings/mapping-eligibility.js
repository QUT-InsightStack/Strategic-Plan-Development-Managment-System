/*
 * Whether a Strategic Plan currently allows its alignment mappings to be
 * archived or restored.
 *
 * Only draft plans are open for mapping changes. Finalised (finished) plans
 * and plans in the approval workflow are locked so the alignment that was
 * submitted or approved cannot change underneath the approvers. Returns a
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
    return null;
}

/** An individual mapping can be archived only while it is active. */
export function mappingArchiveBlockReason(mapping, plan) {
    if (!mapping) return 'This mapping no longer exists.';
    if (mapping.status !== 'active') return 'This mapping is already archived.';
    return mappingChangeLockReason(plan);
}
