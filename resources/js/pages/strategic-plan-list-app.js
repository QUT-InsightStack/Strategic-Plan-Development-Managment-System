import { copyStrategicPlan, deleteStrategicPlan, listStrategicPlans, updateStrategicPlanStatus } from '../api/strategic-plans-api.js';
import { applySubmissionToPlan,getActiveApprovalWorkflow,submitPlanForApproval,} from '../data/plan-approval-demo-data.js';
import { AppSidebar } from '../components/AppSidebar.js';
import { AppDialog } from '../components/AppDialog.js';
import { PageHeader } from '../components/PageHeader.js';
import { enforcePageAccess } from '../access/access-guard.js';
import { PERMISSIONS } from '../access/access-policy.js';
import { can } from '../access/access-session.js';

enforcePageAccess();
const canCreatePlans = can(PERMISSIONS.PLANS_CREATE);
const canReviewPlans = can(PERMISSIONS.PLANS_VIEW);
const canUpdatePlans = can(PERMISSIONS.PLANS_UPDATE);
const canSubmitPlans = can(PERMISSIONS.PLANS_UPDATE);
const canArchivePlans = can(PERMISSIONS.PLANS_ARCHIVE);
const canDeletePlans = can(PERMISSIONS.PLANS_DELETE);
const canSelectPlans = canCreatePlans || canDeletePlans;
const hasPlanActions = canReviewPlans || canUpdatePlans || canSubmitPlans || canArchivePlans || canDeletePlans;

const { useEffect, useState } = React;
const currentYear = new Date().getFullYear();

function StrategicPlanListApp() {
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
                (payload.data || []).map(applySubmissionToPlan)); setMeta(payload.meta || {}); setPage(targetPage); setSelectedIds([]);
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
    (payload.data || []).map(applySubmissionToPlan)); setMeta(payload.meta || {}); setPage(1); setSelectedIds([]); }).catch((error) => setStatus({ type: 'error', message: error.message })).finally(() => setLoading(false));
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
                ? `Restore “${plan.title}” to Finished?`
                : `Archive “${plan.title}”? The plan will be retained and can be restored later.`,
            ids: [plan.record_id],
            action: 'status',
            targetStatus: restoring ? 'finished' : 'archived',
        });
    }

    function requestSubmission(plan) {
    if (!canSubmitPlans) {
        return;
    }

    if (plan.approval_status === 'under_approval') {
        setDialog({
            open: true,
            variant: 'error',
            title: 'Plan already submitted',
            message:
                'This Strategic Plan is already under approval.',
            ids: [],
            action: '',
        });

        return;
    }

    if (plan.status !== 'finished') {
        setDialog({
            open: true,
            variant: 'error',
            title: 'Plan is not eligible',
            message:
                'Only a finished Strategic Plan can be submitted for approval.',
            ids: [],
            action: '',
        });

        return;
    }

    const activeWorkflow =
        getActiveApprovalWorkflow();

    if (!activeWorkflow) {
        setDialog({
            open: true,
            variant: 'error',
            title: 'Submission unavailable',
            message:
                'No active approval workflow is configured. Please contact the Technical Administrator before submitting this plan.',
            ids: [],
            action: '',
        });

        return;
    }

    const firstStage = activeWorkflow.stages[0];

    setDialog({
        open: true,
        variant: 'danger',
        title: 'Submit Strategic Plan for approval?',
        message:
            `“${plan.title}” will enter the ` +
            `“${activeWorkflow.name}” workflow. ` +
            `The first stage will be ` +
            `“${firstStage.name}”, assigned to ` +
            `${firstStage.approver}.`,
        ids: [plan.record_id],
        action: 'submit',
        plan,
    });
}


function confirmSubmission() {
    const plan = dialog.plan;

    setDialog((current) => ({
        ...current,
        open: false,
    }));

    try {
        const submission =
            submitPlanForApproval(plan);

        setPlans((current) =>
            current.map((currentPlan) =>
                currentPlan.record_id ===
                plan.record_id
                    ? applySubmissionToPlan(
                        currentPlan
                    )
                    : currentPlan
            )
        );

        setDialog({
            open: true,
            variant: 'success',
            title: 'Plan submitted successfully',
            message:
                `“${plan.title}” is now under approval. ` +
                `Current stage: ${submission.currentStage.name}. ` +
                `Assigned to: ${submission.currentStage.approver}.`,
            ids: [],
            action: '',
        });
    } catch (error) {
        setDialog({
            open: true,
            variant: 'error',
            title: 'Submission failed',
            message:
                error.message ||
                'The Strategic Plan could not be submitted.',
            ids: [],
            action: '',
        });
    }
}
    async function confirmDialogAction() {
        if (dialog.action === 'delete') return confirmDeletion();
        if (dialog.action === 'submit') { return confirmSubmission();}
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
            React.createElement('section', { className: 'ui-card plans-filter-card', 'aria-labelledby': 'filter-title' },
                React.createElement('div', { className: 'plans-section-header' },
                    React.createElement('div', null,
                        React.createElement('h2', { className: 'plans-filter-title', id: 'filter-title' }, 'Find strategic plans'),
                        React.createElement('p', null, 'Search the plan register or narrow the results using the available filters.')
                    ),
                    React.createElement('i', { className: 'bi bi-funnel', 'aria-hidden': 'true' })
                ),
                React.createElement('div', { className: 'ui-card__body' },
                    React.createElement('form', { className: 'plans-toolbar', onSubmit: (event) => { event.preventDefault(); load(1); } },
                        React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'search' }, 'Plan title'), React.createElement('div', { className: 'plans-search' }, React.createElement('input', { className: 'ui-input', id: 'search', value: filters.search, placeholder: 'Search by plan title', onChange: (event) => setFilters((current) => ({ ...current, search: event.target.value })) }), React.createElement('i', { className: 'bi bi-search', 'aria-hidden': 'true' }))),
                        React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'office' }, 'Office'), React.createElement('select', { className: 'ui-select', id: 'office', value: filters.office, onChange: (event) => { setFilters((current) => ({ ...current, office: event.target.value })); setStatus({ type: 'info', message: 'Office filtering will be enabled when the plan department field is added to the database.' }); } }, React.createElement('option', { value: '' }, 'All offices'))),
                        React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'level' }, 'Type'), React.createElement('select', { className: 'ui-select', id: 'level', value: filters.level, onChange: (event) => setFilters((current) => ({ ...current, level: event.target.value })) }, React.createElement('option', { value: '' }, 'All types'), React.createElement('option', { value: 'strategic_plan' }, 'Strategic Plan'), React.createElement('option', { value: 'goal' }, 'Goal'))),
                        React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'status' }, 'Status'), React.createElement('select', { className: 'ui-select', id: 'status', value: filters.status, onChange: (event) => setFilters((current) => ({ ...current, status: event.target.value })) }, React.createElement('option', { value: '' }, 'All statuses'), React.createElement('option', { value: 'draft' }, 'Draft'), React.createElement('option', { value: 'finished' }, 'Finished'), React.createElement('option', { value: 'archived' }, 'Archived'))),
                        React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'year' }, 'Year'), React.createElement('select', { className: 'ui-select', id: 'year', value: filters.year, onChange: (event) => setFilters((current) => ({ ...current, year: event.target.value })) }, React.createElement('option', { value: '' }, 'All years'), [0,1,2,3,4].map((offset) => React.createElement('option', { value: currentYear - offset, key: currentYear - offset }, currentYear - offset)))),
                        React.createElement('div', { className: 'plans-filter-actions' }, React.createElement('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'submit', disabled: loading }, React.createElement('i', { className: 'bi bi-funnel-fill' }), 'Filter'), React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: clearFilters, disabled: loading }, 'Clear'))
                    )
                )
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
                        ['Plan ID', 'Plan Title', 'Status', 'Plan Status', 'Approval Status', 'Current Stage', 'Created By', 'Department', 'Latest Upload', 'Actions'].map((heading) => React.createElement('th', { key: heading }, heading))
                    )),
                    React.createElement('tbody', null, plans.map((plan) => React.createElement('tr', { key: plan.record_id },
                        canSelectPlans ? React.createElement('td', { className: 'plans-select-column' }, React.createElement('input', { type: 'checkbox', checked: selectedIds.includes(plan.record_id), onChange: () => toggleSelection(plan.record_id), 'aria-label': `Select ${plan.title}` })) : null,
                        React.createElement('td', null, React.createElement('span', { className: 'plans-id' }, String(plan.record_id).padStart(4, '0'))),
                        React.createElement('td', null, React.createElement('strong', null, plan.title)),
                        React.createElement('td', null, React.createElement('span', { className: `ui-badge ui-badge--${plan.status || 'draft'}` }, (plan.status || 'draft').replace(/^./, (letter) => letter.toUpperCase()))),
                        React.createElement('td', null,plan.approval_status? React.createElement( 'span',{className:'ui-badge plan-approval-badge',},'Under Approval'): React.createElement('span',{className:'plan-approval-not-submitted',},'Not submitted' )),
                        React.createElement('td',null,plan.approval_stage? React.createElement('div',{className:'plan-current-stage',},
                        React.createElement('strong',null,plan.approval_stage.name),
                        React.createElement('small',null,`Assigned to: ${plan.approval_stage.approver}`)): React.createElement('span',{className: 'ui-help', },'—')),
                        React.createElement('td', null, creatorName(plan)), React.createElement('td', null, plan.creator?.department || 'Pending DB field'),
                        React.createElement('td', null, plan.updated_at ? new Date(plan.updated_at).toLocaleDateString() : '—'),
                        React.createElement('td', { className: 'plans-actions-cell' }, hasPlanActions ? React.createElement('div', { className: 'ui-table__actions' },
                            canReviewPlans ? React.createElement('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: `/strategic-plans/${plan.record_id}/objectives`, 'aria-label': `Review ${plan.title}` }, React.createElement('i', { className: 'bi bi-eye' }), 'Review') : null,
                            canUpdatePlans && plan.status !== 'archived'
    ? React.createElement(
        'a',
        {
            className:
                'ui-button ui-button--secondary ui-button--sm',
            href:
                `/strategic-plans/${plan.record_id}/edit`,
            'aria-label':
                plan.status === 'draft'
                    ? `Continue ${plan.title}`
                    : `Update ${plan.title}`,
        },
        React.createElement('i', {
            className:
                plan.status === 'draft'
                    ? 'bi bi-arrow-right-circle'
                    : 'bi bi-pencil',
        }),
        plan.status === 'draft'
            ? 'Continue Plan'
            : 'Update'
    )
    : null,
        canSubmitPlans &&
plan.status === 'finished' &&
!plan.approval_status
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
        },

        React.createElement('i', {
            className:
                'bi bi-send-check',
        }),

        'Submit for Approval'
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


                            canArchivePlans && ['finished', 'archived'].includes(plan.status) ? React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => requestStatusChange(plan), 'aria-label': `${plan.status === 'archived' ? 'Restore' : 'Archive'} ${plan.title}` }, React.createElement('i', { className: `bi ${plan.status === 'archived' ? 'bi-arrow-counterclockwise' : 'bi-archive'}` }), plan.status === 'archived' ? 'Restore' : 'Archive') : null,
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

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(StrategicPlanListApp));
