import { copyStrategicPlan, deleteStrategicPlan, listStrategicPlans, updateStrategicPlanStatus } from '../../api/strategic-plans-api.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { AppDialog } from '../../components/AppDialog.js';
import { PageHeader } from '../../components/PageHeader.js';
import { FilterBar, FilterSearch, FilterSelect } from '../../components/FilterBar.js';
import { mountProtectedPage } from '../../access/mount-protected-page.js';
import { PERMISSIONS } from '../../access/access-policy.js';
import { can } from '../../access/access-session.js';

const { useEffect, useState } = React;
const currentYear = new Date().getFullYear();
// The register shows plan preparation status only; approval progress has its own column.
const PLAN_STATUS_LABELS = { draft: 'Draft', finished: 'Finished' };

function planStatus(plan) {
    const status = plan.status === 'archived' ? plan.status_before_archive : plan.status;
    return status === 'draft' ? 'draft' : 'finished';
}

function StrategicPlanListApp() {
    const canCreatePlans = can(PERMISSIONS.PLANS_CREATE);
    const canUpdatePlans = can(PERMISSIONS.PLANS_UPDATE);
    const canSubmitPlans = can(PERMISSIONS.PLANS_UPDATE);
    const canArchivePlans = can(PERMISSIONS.PLANS_ARCHIVE);
    const canDeletePlans = can(PERMISSIONS.PLANS_DELETE);
    const canSelectPlans = canCreatePlans || canDeletePlans;
    const hasPlanActions = canUpdatePlans || canArchivePlans || canDeletePlans;

    const [plans, setPlans] = useState([]);
    const [filters, setFilters] = useState({ search: '', office: '', level: '', status: '', year: '' });
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [dialog, setDialog] = useState({ open: false, variant: 'success', title: '', message: '', ids: [], action: '' });

    async function load(targetPage = page) {
        setLoading(true);
        try {
            const payload = await listStrategicPlans({ search: filters.search, level: filters.level, status: filters.status, year: filters.year, page: targetPage });
            setPlans(
                (payload.data || [])); setMeta(payload.meta || {}); setPage(targetPage); setSelectedIds([]);
        } catch (error) { setStatus({ type: 'error', message: error.message }); }
        finally { setLoading(false); }
    }

    useEffect(() => {
        load(1);
        const successMessage = window.sessionStorage.getItem('planSuccessMessage');
        if (successMessage) {
            window.sessionStorage.removeItem('planSuccessMessage');
            setDialog({ open: true, variant: 'success', title: 'Operation successful', message: successMessage, ids: [] });
        }
    }, []);

    function clearFilters() {
        const cleared = { search: '', office: '', level: '', status: '', year: '' };
        setFilters(cleared);
        setLoading(true);
        listStrategicPlans({ page: 1 }).then((payload) => { setPlans(
    (payload.data || [])); setMeta(payload.meta || {}); setPage(1); setSelectedIds([]); }).catch((error) => setStatus({ type: 'error', message: error.message })).finally(() => setLoading(false));
    }

    function toggleSelection(id) {
        setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    }

    function toggleAll() {
        setSelectedIds(selectedIds.length === plans.length ? [] : plans.map((plan) => plan.record_id));
    }

    function requestDelete(plan) {
        if (!canDeletePlans) return;
        setDialog({ open: true, variant: 'danger', title: 'Confirm deletion', message: `Are you sure you want to delete “${plan.title}”? This action cannot be undone.`, ids: [plan.record_id], action: 'delete' });
    }

    function requestDeleteSelected() {
        if (!canDeletePlans) return;
        if (!selectedIds.length) return setStatus({ type: 'error', message: 'Select at least one plan to delete.' });
        setDialog({ open: true, variant: 'danger', title: 'Confirm bulk deletion', message: `Are you sure you want to delete ${selectedIds.length} selected plan(s)? This action cannot be undone.`, ids: selectedIds, action: 'delete' });
    }

    async function confirmDeletion() {
        const ids = dialog.ids;
        setDialog((current) => ({ ...current, open: false }));
        setLoading(true);
        try {
            await Promise.all(ids.map(deleteStrategicPlan));
            await load(page);
            setDialog({ open: true, variant: 'success', title: 'Operation successful', message: `${ids.length} strategic plan(s) deleted successfully.`, ids: [] });
        }
        catch (error) { setStatus({ type: 'error', message: error.message }); setLoading(false); }
    }

    function requestStatusChange(plan) {
        if (!canArchivePlans) return;
        const restoring = plan.status === 'archived';
        setDialog({
            open: true,
            variant: 'danger',
            title: restoring ? 'Restore strategic plan' : 'Archive strategic plan',
            message: restoring
                ? `Restore “${plan.title}” to ${PLAN_STATUS_LABELS[planStatus(plan)]}?`
                : `Archive “${plan.title}”? The plan will be retained and can be restored later.`,
            ids: [plan.record_id],
            action: 'status',
            targetStatus: restoring ? 'finished' : 'archived',
        });
    }

    function requestSubmission(plan) {
        if (canSubmitPlans) window.location.assign(`/strategic-plans/${plan.record_id}/finalize`);
    }

    async function confirmDialogAction() {
        if (dialog.action === 'delete') return confirmDeletion();
        if (dialog.action !== 'status') return;

        const id = dialog.ids[0];
        const targetStatus = dialog.targetStatus;
        setDialog((current) => ({ ...current, open: false }));
        setLoading(true);
        try {
            const payload = await updateStrategicPlanStatus(id, targetStatus);
            await load(page);
            setDialog({ open: true, variant: 'success', title: 'Operation successful', message: payload.message, ids: [], action: '' });
        } catch (error) {
            setDialog({ open: true, variant: 'error', title: 'Status update failed', message: error.message, ids: [], action: '' });
            setLoading(false);
        }
    }

    async function copySelectedPlan() {
        if (selectedIds.length !== 1) {
            setDialog({ open: true, variant: 'error', title: 'Unable to copy plan', message: 'Select exactly one existing Strategic Plan to copy.', ids: [] });
            return;
        }

        setLoading(true);
        try {
            const payload = await copyStrategicPlan(selectedIds[0]);
            await load(1);
            setDialog({ open: true, variant: 'success', title: 'Operation successful', message: payload.message, ids: [] });
        } catch (error) {
            setDialog({ open: true, variant: 'error', title: 'Copy failed', message: error.message || 'The Strategic Plan could not be copied.', ids: [] });
            setLoading(false);
        }
    }

    function creatorName(plan) {
        const creator = plan.creator;
        if (!creator) return '—';
        return [creator.first_name, creator.last_name].filter(Boolean).join(' ');
    }

    function approvalStatusLabel(status) {
    const labels = {
        under_approval: 'Under Approval',
        approved: 'Approved',
        rejected: 'Rejected',
    };

    return labels[status] || 'Not submitted';
}

function approvalStatusClass(status) {
    const classes = {
        under_approval: 'is-pending',
        approved: 'is-approved',
        rejected: 'is-rejected',
    };

    return classes[status] || '';
}

    return React.createElement(React.Fragment, null,
        React.createElement(AppSidebar, { onNotice: (message) => setStatus({ type: 'info', message }) }),
        React.createElement('main', { className: 'app-shell-main manage-plans-page' }, React.createElement('div', { className: 'app-shell-container' },
            React.createElement(PageHeader, {
                className: 'manage-plans-header',
                section: 'Strategic Planning',
                title: 'Manage Strategic Plans',
                subtitle: 'Update draft strategic plans, consolidate agency inputs, monitor objective progress, and prepare finalized plans for approval.',
                actions: canCreatePlans ? React.createElement('a', { className: 'ui-button ui-button--primary manage-plans-create', href: '/strategic-plans/create' }, React.createElement('i', { className: 'bi bi-plus-lg' }), 'Create Strategic Plan') : null,
            }),
            status.message ? React.createElement('div', { className: `ui-status ui-status--${status.type} plans-feedback`, role: 'status' }, status.message) : null,
            React.createElement(FilterBar, { label: 'Filter strategic plans', busy: loading, onSubmit: () => load(1), onClear: clearFilters },
                React.createElement(FilterSearch, { id: 'search', label: 'Plan title', value: filters.search, placeholder: 'Search by plan title', onChange: (search) => setFilters((current) => ({ ...current, search })) }),
                React.createElement(FilterSelect, { id: 'office', label: 'Office', value: filters.office, allLabel: 'All offices', options: [], onChange: (office) => { setFilters((current) => ({ ...current, office })); setStatus({ type: 'info', message: 'Office filtering will be enabled when the plan department field is added to the database.' }); } }),
                React.createElement(FilterSelect, { id: 'level', label: 'Type', value: filters.level, allLabel: 'All types', options: [['strategic_plan', 'Strategic Plan'], ['goal', 'Goal']], onChange: (level) => setFilters((current) => ({ ...current, level })) }),
                React.createElement(FilterSelect, { id: 'status', label: 'Status', value: filters.status, allLabel: 'All statuses', options: [['draft', 'Draft'], ['finished', 'Finished'], ['archived', 'Archived']], onChange: (status) => setFilters((current) => ({ ...current, status })) }),
                React.createElement(FilterSelect, { id: 'year', label: 'Year', value: filters.year, allLabel: 'All years', options: [0, 1, 2, 3, 4].map((offset) => [String(currentYear - offset), currentYear - offset]), onChange: (year) => setFilters((current) => ({ ...current, year })) })
            ),
            React.createElement('section', { className: 'ui-card plans-card', 'aria-labelledby': 'plans-table-title' },
                React.createElement('div', { className: 'plans-table-heading' }, React.createElement('div', null,
                    React.createElement('h2', { id: 'plans-table-title' }, 'Strategic Plan Register'),
                    React.createElement('p', null, loading ? 'Loading the latest plan records…' : `${meta.total || 0} plan record(s) available`)
                ), canSelectPlans ? React.createElement('div', { className: 'plans-heading-actions' },
                    canCreatePlans ? React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm plans-selection-action', type: 'button', onClick: copySelectedPlan, disabled: loading }, React.createElement('i', { className: 'bi bi-copy' }), 'Copy Selected') : null,
                    canDeletePlans ? React.createElement('button', { className: 'ui-button ui-button--danger ui-button--sm plans-selection-action', type: 'button', onClick: requestDeleteSelected, disabled: !selectedIds.length || loading }, React.createElement('i', { className: 'bi bi-trash3' }), 'Delete Selected') : null
                ) : null),
                React.createElement('div', { className: 'ui-card__body' }, loading ? React.createElement('div', { className: 'ui-empty' }, 'Loading strategic plans…') : plans.length === 0 ? React.createElement('div', { className: 'ui-empty' }, 'No strategic plans match the current filters.') : React.createElement('div', { className: 'ui-table-wrap' }, React.createElement('table', { className: 'ui-table plans-table' },
                    React.createElement('thead', null, React.createElement('tr', null,
                        canSelectPlans ? React.createElement('th', { className: 'plans-select-column' }, React.createElement('input', { type: 'checkbox', checked: plans.length > 0 && selectedIds.length === plans.length, onChange: toggleAll, 'aria-label': 'Select all plans' })) : null,
                        ['Plan ID', 'Plan Title', 'Plan Status', 'Approval Status', 'Current Stage', 'Created By', 'Department', 'Latest Upload', 'Actions'].map((heading) => React.createElement('th', { key: heading }, heading))
                    )),
                    React.createElement('tbody', null, plans.map((plan) => React.createElement('tr', { key: plan.record_id },
                        canSelectPlans ? React.createElement('td', { className: 'plans-select-column' }, React.createElement('input', { type: 'checkbox', checked: selectedIds.includes(plan.record_id), onChange: () => toggleSelection(plan.record_id), 'aria-label': `Select ${plan.title}` })) : null,
                        React.createElement('td', null, React.createElement('span', { className: 'plans-id' }, String(plan.record_id).padStart(4, '0'))),
                        React.createElement('td', null, React.createElement('strong', null, plan.title)),
                        React.createElement('td', null,
                            React.createElement('span', { className: `ui-badge ui-badge--${planStatus(plan)}` }, PLAN_STATUS_LABELS[planStatus(plan)]),
                            plan.status === 'archived' ? React.createElement('span', { className: 'ui-badge ui-badge--archived plan-archived-tag' }, 'Archived') : null
                        ),
                        React.createElement(
    'td',
    null,
    plan.approval_status && plan.approval_status !== 'not_submitted'
        ? React.createElement(
            'a',
            {
                className:
                    `ui-badge plan-approval-badge ` +
                    `${approvalStatusClass(plan.approval_status)}`,
                href: `/strategic-plans/${plan.record_id}/approval-status`,
                title: 'View approval status and history',
            },
            approvalStatusLabel(
                plan.approval_status
            )
        )
        : React.createElement(
            'span',
            {
                className:
                    'plan-approval-not-submitted',
            },
            'Not submitted'
        )
),
                        React.createElement('td', null, plan.approval_status === 'under_approval'
                            ? React.createElement('a', { href: `/strategic-plans/${plan.record_id}/approval-status` }, 'View stage and approver')
                            : React.createElement('span', { className: 'ui-help' }, 'No pending stage')),
                        React.createElement('td', null, creatorName(plan)), React.createElement('td', null, plan.creator?.department || 'Pending DB field'),
                        React.createElement('td', null, plan.updated_at ? new Date(plan.updated_at).toLocaleDateString() : '—'),
                        React.createElement('td', { className: 'plans-actions-cell' }, hasPlanActions ? React.createElement('div', { className: 'ui-table__actions' },
                            canUpdatePlans && ['draft', 'finished'].includes(plan.status) ? React.createElement('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: `/strategic-plans/${plan.record_id}/finalize`, 'aria-label': `Finalize ${plan.title}` }, React.createElement('i', { className: 'bi bi-clipboard-check' }), plan.status === 'finished' ? 'Finalized View' : 'Finalize') : null,
                            canUpdatePlans && (plan.status === 'draft' || plan.approval_status === 'rejected')
    ? React.createElement(
        'a',
        {
            className:
                'ui-button ui-button--secondary ui-button--sm',
            href: plan.status === 'draft'
    ? `/strategic-plans/${plan.record_id}/overview`
    : `/strategic-plans/${plan.record_id}/edit`,
            'aria-label': `Edit ${plan.title}`,
        },
        React.createElement('i', {
            className: 'bi bi-pencil',
        }),
        'Edit'
    )
    : null,
        canSubmitPlans &&
plan.status === 'finished' &&
['not_submitted', 'rejected'].includes(plan.approval_status || 'not_submitted')
    ? React.createElement(
        'button',
        {
            className:
                'ui-button ui-button--primary ui-button--sm',
            type: 'button',
            onClick: () =>
                requestSubmission(plan),
            'aria-label':
                `Submit ${plan.title} for approval`,
            disabled: Object.keys(plan.preparation_errors || {}).length > 0,
            title: Object.values(plan.preparation_errors || {}).join(' '),
        },

        React.createElement('i', {
            className:
                'bi bi-send-check',
        }),

        plan.approval_status === 'rejected' ? 'Resubmit for Approval' : 'Submit for Approval'
    )
    : null,
    canSubmitPlans &&
plan.approval_status === 'under_approval'
    ? React.createElement(
        'button',
        {
            className:
                'ui-button ui-button--secondary ui-button--sm',
            type: 'button',
            disabled: true,
            title:
                'This plan is already under approval.',
        },

        React.createElement('i', {
            className:
                'bi bi-hourglass-split',
        }),

        'Submitted'
    )
    : null,


                             canArchivePlans
    && ['draft', 'finished', 'archived'].includes(plan.status)
    && plan.approval_status !== 'under_approval'? React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => requestStatusChange(plan), 'aria-label': `${plan.status === 'archived' ? 'Restore' : 'Archive'} ${plan.title}` }, React.createElement('i', { className: `bi ${plan.status === 'archived' ? 'bi-arrow-counterclockwise' : 'bi-archive'}` }), plan.status === 'archived' ? 'Restore' : 'Archive') : null,
                            canDeletePlans ? React.createElement('button', { className: 'ui-button ui-button--danger ui-button--sm', type: 'button', onClick: () => requestDelete(plan), 'aria-label': `Delete ${plan.title}` }, React.createElement('i', { className: 'bi bi-trash3' }), 'Delete') : null
                        ) : React.createElement('span', { className: 'ui-help' }, 'View only'))
                    )))
                ))),
                React.createElement('div', { className: 'plans-table-footer' }, React.createElement('span', null, canSelectPlans ? `${selectedIds.length} of ${meta.total || 0} plan(s) selected` : `${meta.total || 0} plan(s)`), React.createElement('div', { className: 'plans-pagination' },
                    React.createElement('span', null, `Page ${meta.current_page || 1} of ${meta.last_page || 1}`),
                    React.createElement('div', { className: 'ui-pagination__actions' }, React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', disabled: loading || page <= 1, onClick: () => load(page - 1), 'aria-label': 'Previous page' }, React.createElement('i', { className: 'bi bi-chevron-left' })), React.createElement('span', { className: 'plans-current-page' }, meta.current_page || 1), React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', disabled: loading || page >= (meta.last_page || 1), onClick: () => load(page + 1), 'aria-label': 'Next page' }, React.createElement('i', { className: 'bi bi-chevron-right' })))
                ))
            )
        )),
        React.createElement(AppDialog, {
            open: dialog.open,
            variant: dialog.variant,
            title: dialog.title,
            message: dialog.message,
            confirmLabel: dialog.action === 'delete' ? 'Confirm Delete' : dialog.action === 'submit'? 'Submit Plan': dialog.targetStatus === 'archived' ? 'Archive' : dialog.targetStatus === 'finished' ? 'Restore' : 'Continue',
            onConfirm: dialog.variant === 'danger' ? confirmDialogAction : () => setDialog((current) => ({ ...current, open: false })),
            onCancel: () => setDialog((current) => ({ ...current, open: false })),
        })
    );
}

mountProtectedPage(document.getElementById('root'), () => React.createElement(StrategicPlanListApp));
