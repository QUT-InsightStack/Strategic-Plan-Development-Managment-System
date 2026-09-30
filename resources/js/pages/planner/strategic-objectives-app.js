import { getStrategicPlan } from '../../api/strategic-plans-api.js';
import {
    createStrategicObjective,
    deleteStrategicObjective,
    listStrategicObjectives,
    assignResponsibleUnit,
    listResponsibleUnits,
    updateStrategicObjective,
    updateStrategicObjectiveStatus,
} from '../../api/strategic-objectives-api.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { AppDialog } from '../../components/AppDialog.js';
import { PageHeader } from '../../components/PageHeader.js';
import { ObjectiveProgressPanel } from '../../strategic-objectives/ObjectiveProgressPanel.js';
import { ObjectiveFormDialog } from '../../strategic-objectives/ObjectiveFormDialog.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { PERMISSIONS } from '../../access/access-policy.js';
import { can, getAccessSession } from '../../access/access-session.js';
import { getAssignableUnits } from '../../objective-assignment-storage.js';

enforcePageAccess();
const canCreateObjectives = can(PERMISSIONS.OBJECTIVES_CREATE);

const canUpdateObjectives = can(PERMISSIONS.OBJECTIVES_UPDATE);

const canArchiveObjectives = can(PERMISSIONS.OBJECTIVES_ARCHIVE);

const canDeleteObjectives = can(PERMISSIONS.OBJECTIVES_DELETE);

const hasObjectiveActions =
    canUpdateObjectives ||
    canArchiveObjectives ||
    canDeleteObjectives;

const { useEffect, useState } = React;
const root = document.getElementById('root');
const planId = root.dataset.planId;
const pageSize = 10;
function formatDate(value) {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}
function displayName(user) {
    if (!user) return '';

    return user.name ||
        [user.first_name, user.last_name]
            .filter(Boolean)
            .join(' ');
}

function formatPlanPeriod(plan) {
    if (!plan) return '—';

    const startDate =
        plan.planning_start_date ||
        plan.start_date;

    const endDate =
        plan.planning_end_date ||
        plan.end_date;

    if (startDate || endDate) {
        return [formatDate(startDate), formatDate(endDate)]
            .filter(Boolean)
            .join(' – ');
    }

    return plan.planning_period || 'Not available';
}

function StrategicObjectivesApp() {
    const [plan, setPlan] = useState(null);
    const [objectives, setObjectives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [editing, setEditing] = useState(null);
    const [assigning, setAssigning] = useState(null);
    const [selectedUnit, setSelectedUnit] = useState('');
    const [responsibleUnits, setResponsibleUnits] = useState([]);
    const [assignmentError, setAssignmentError] = useState('');
    const [formOpen, setFormOpen] = useState(false);
    const [formErrors, setFormErrors] = useState({});
    const [page, setPage] = useState(1);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [dialog, setDialog] = useState({
    open: false,
    variant: 'success',
    title: '',
    message: '',
    objective: null,
    action: null,
});

    async function load() {
        setLoading(true);
        try {
            const [planPayload, objectivesPayload, unitsPayload] = await Promise.all([
                getStrategicPlan(planId),
                listStrategicObjectives(planId),
                listResponsibleUnits({ per_page: 100 }),
            ]);
            const assignedObjectives = objectivesPayload.data || [];
            setPlan(planPayload.data); setObjectives(assignedObjectives);
            setResponsibleUnits((unitsPayload.data || []).map(unit => unit.responsible_office_agency));
            const editId = new URLSearchParams(window.location.search).get('edit');
            if (editId && canUpdateObjectives) {
                const objectiveToEdit = assignedObjectives.find((item) => String(item.objective_id) === editId);
                if (objectiveToEdit) { setEditing(objectiveToEdit); setFormOpen(true); }
                window.history.replaceState({}, '', window.location.pathname);
            }
        } catch (error) { setStatus({ type: 'error', message: error.message }); }
        finally { setLoading(false); }
    }

    useEffect(() => { load(); }, []);

    async function saveObjective(data) {
        if ((editing && !canUpdateObjectives) || (!editing && !canCreateObjectives)) return;
        setSubmitting(true); setFormErrors({});
        try {
            const payload = editing
                ? await updateStrategicObjective(editing.objective_id, data)
                : await createStrategicObjective({ ...data, strategic_plan_id: Number(planId) });
            setFormOpen(false); setEditing(null); await load();
            if (!editing) setPage(Math.ceil((objectives.length + 1) / pageSize));
            setDialog({ open: true, variant: 'success', title: 'Operation successful', message: editing ? 'Strategic Objective updated successfully.' : 'Strategic Objective added successfully.', objective: null });
            return payload;
        } catch (error) { setFormErrors(error.errors || {}); setStatus({ type: 'error', message: error.message }); }
        finally { setSubmitting(false); }
    }

   function requestDelete(objective) {
    if (!canDeleteObjectives) return;

    setDialog({
        open: true,
        variant: 'danger',
        title: 'Delete Strategic Objective?',
        message: `Delete “${objective.objective_title || 'Untitled objective'}”? This action cannot be undone.`,
        objective,
        action: 'delete',
    });
}

function requestArchiveChange(objective) {
    if (!canArchiveObjectives || archived) return;

    const restoring = objective.status === 'archived';

    setDialog({
        open: true,
        variant: restoring ? 'success' : 'danger',
        title: restoring
            ? 'Restore Strategic Objective?'
            : 'Archive Strategic Objective?',
        message: restoring
            ? `Restore “${objective.objective_title || 'Untitled objective'}”?`
            : `Archive “${objective.objective_title || 'Untitled objective'}”? The objective will remain stored and can be restored later.`,
        objective,
        action: restoring ? 'restore' : 'archive',
    });
}

async function confirmDelete() {
    const objective = dialog.objective;

    setDialog((current) => ({ ...current, open: false }));
    setSubmitting(true);

    try {
        await deleteStrategicObjective(objective.objective_id);
        await load();

        setDialog({
            open: true,
            variant: 'success',
            title: 'Operation successful',
            message: 'Strategic Objective deleted successfully.',
            objective: null,
            action: null,
        });
    } catch (error) {
        setDialog({
            open: true,
            variant: 'error',
            title: 'Delete failed',
            message: error.message,
            objective: null,
            action: null,
        });
    } finally {
        setSubmitting(false);
    }
}

async function confirmArchiveChange() {
    const objective = dialog.objective;
    const restoring = dialog.action === 'restore';

    setDialog((current) => ({ ...current, open: false }));
    setSubmitting(true);

    try {
        await updateStrategicObjectiveStatus(
            objective.objective_id,
            restoring ? 'restored' : 'archived'
        );

        await load();

        setDialog({
            open: true,
            variant: 'success',
            title: 'Operation successful',
            message: restoring
                ? 'Strategic Objective restored successfully.'
                : 'Strategic Objective archived successfully.',
            objective: null,
            action: null,
        });
    } catch (error) {
        setDialog({
            open: true,
            variant: 'error',
            title: restoring ? 'Restore failed' : 'Archive failed',
            message: error.message,
            objective: null,
            action: null,
        });
    } finally {
        setSubmitting(false);
    }
}
    const archived = plan?.status === 'archived';
    const availableUnits = getAssignableUnits(objectives, [getAccessSession()?.office, ...responsibleUnits]);

    async function assignUnit() {
        if (!assigning || !canUpdateObjectives || !selectedUnit.trim()) return;
        setSubmitting(true);
        setAssignmentError('');
        try {
            const payload = await assignResponsibleUnit(assigning.objective_id, selectedUnit.trim());
            const updated = payload.data;
            setObjectives(current => current.map(objective => objective.objective_id === updated.objective_id ? updated : objective));
            setAssigning(null);
            setStatus({ type: 'success', message: `Objective assigned to ${selectedUnit}. It is now available in that Office / Agency view.` });
        } catch (error) {
            setAssignmentError(error.message || 'Unable to assign Responsible Unit.');
        } finally {
            setSubmitting(false);
        }
    }
const planYear = plan?.created_at
    ? new Date(plan.created_at).getFullYear()
    : new Date().getFullYear();

const updatedBy =
    displayName(plan?.updater) ||
    displayName(plan?.creator);


    const totalPages = Math.max(
    1,
    Math.ceil(objectives.length / pageSize)
);

const currentPage = Math.min(page, totalPages);

const visibleObjectives = objectives.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
);

useEffect(() => {
    if (page > totalPages) {
        setPage(totalPages);
    }
}, [page, totalPages]);

    return React.createElement(React.Fragment, null,
        React.createElement(AppSidebar, { onNotice: (message) => setStatus({ type: 'info', message }) }),
        React.createElement('main', { className: 'app-shell-main objectives-page' }, React.createElement('div', { className: 'app-shell-container' },
            React.createElement(PageHeader, { className: 'objectives-header', section: 'Strategic Planning', title: 'Manage Objectives', subtitle: 'Create strategic objectives and assign responsible offices and agencies.' }),
            can(PERMISSIONS.OBJECTIVES_VIEW_PROGRESS) && React.createElement('details', null,
                React.createElement('summary', null, 'Monitor and update progress'),
                React.createElement(ObjectiveProgressPanel, { planId })),
            status.message ? React.createElement('div', { className: `ui-status ui-status--${status.type}`, role: 'status' }, status.message) : null,
            archived ? React.createElement('div', { className: 'ui-status ui-status--error' }, 'This Strategic Plan is archived. Restore it before changing its objectives.') : null,
            React.createElement('section', { className: 'ui-card plan-summary', 'aria-labelledby': 'plan-summary-title' }, React.createElement('div', { className: 'ui-card__header' }, React.createElement('h2', { className: 'ui-card__title', id: 'plan-summary-title' }, 'Plan Summary')), React.createElement('div', { className: 'ui-card__body plan-summary-grid' },
                React.createElement(
    'div',
    { className: 'plan-summary-item' },
    React.createElement('span', null, 'Plan ID'),
    React.createElement(
        'strong',
        null,
        plan
            ? `SP-${planYear}-${String(plan.record_id).padStart(3, '0')}`
            : '—'
    )
),

React.createElement(
    'div',
    { className: 'plan-summary-item' },
    React.createElement('span', null, 'Plan Title'),
    React.createElement(
        'strong',
        null,
        plan?.title || (loading ? 'Loading…' : '—')
    )
),

React.createElement(
    'div',
    { className: 'plan-summary-item' },
    React.createElement('span', null, 'Plan Period'),
    React.createElement(
        'strong',
        null,
        formatPlanPeriod(plan)
    )
),

React.createElement(
    'div',
    { className: 'plan-summary-item' },
    React.createElement('span', null, 'Department/Agency'),
    React.createElement(
        'strong',
        null,
        plan?.department_agency ||
            plan?.creator?.department ||
            plan?.creator?.office ||
            'Not available'
    )
),

React.createElement(
    'div',
    { className: 'plan-summary-item' },
    React.createElement('span', null, 'Last Updated'),
    React.createElement(
        'strong',
        null,
        formatDate(plan?.updated_at) || '—',
        updatedBy
            ? React.createElement(
                'small',
                null,
                `by ${updatedBy}`
            )
            : null
    )
)
            )),
            React.createElement('section', { className: 'ui-card objectives-card', 'aria-labelledby': 'objectives-title' },
                React.createElement('div', { className: 'objectives-heading' }, React.createElement('h2', { id: 'objectives-title' }, 'Strategic Objectives'), canCreateObjectives ? React.createElement('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', disabled: archived || loading, onClick: () => { setEditing(null); setFormOpen(true); } }, React.createElement('i', { className: 'bi bi-plus-lg' }), 'Add Objective') : null),
                React.createElement('div', { className: 'ui-card__body' }, loading ? React.createElement('div', { className: 'ui-empty' }, 'Loading Strategic Objectives…') : objectives.length === 0 ? React.createElement('div', { className: 'ui-empty' }, 'No Strategic Objectives have been added yet.') : React.createElement('div', { className: 'ui-table-wrap' }, React.createElement('table', { className: 'ui-table objectives-table' },
                    React.createElement('thead', null, React.createElement('tr', null, ['No.', 'Strategic Objective', 'Expected Outcome', 'Indicator', 'Responsible Unit', 'Actions']
                        .map((heading) => React.createElement('th', { key: heading }, heading)))),
                    React.createElement('tbody', null, visibleObjectives.map((objective, index) => React.createElement('tr', { key: objective.objective_id }, React.createElement(
    'td',
    null,
    ((currentPage - 1) * pageSize) + index + 1
), React.createElement('td', null, objective.objective_title || 'Untitled objective'), React.createElement('td', null, objective.expected_outcome || '—'), React.createElement('td', null, objective.indicator || '—'), React.createElement('td', null, objective.responsible_office_agency || 'Unassigned'),

React.createElement(
    'td',
    null,
    hasObjectiveActions
        ? React.createElement(
            'div',
            { className: 'objectives-table__actions' },
            canUpdateObjectives && objective.status !== 'archived'
                ? React.createElement('button', {
                    className: 'ui-button ui-button--secondary ui-button--sm',
                    type: 'button', disabled: archived || submitting,
                    onClick: () => { setAssigning(objective); setSelectedUnit(objective.responsible_office_agency || ''); setAssignmentError(''); },
                    'aria-label': `Assign Responsible Unit to ${objective.objective_title || 'strategic objective'}`,
                }, 'Assign') : null,

            canUpdateObjectives &&
            objective.status !== 'archived'
                ? React.createElement(
                    'button',
                    {
                        className:
                            'ui-button ui-button--secondary ui-button--sm',
                        type: 'button',
                        disabled: archived,
                        onClick: () => {
                            setEditing(objective);
                            setFormOpen(true);
                        },
                        'aria-label':
                            `Update ${objective.objective_title || 'strategic objective'}`,
                    },
                    React.createElement('i', {
                        className: 'bi bi-pencil',
                    })
                )
                : null,

            canArchiveObjectives
                ? React.createElement(
                    'button',
                    {
                        className:
                            'ui-button ui-button--secondary ui-button--sm',
                        type: 'button',
                        disabled: archived,
                        onClick: () =>
                            requestArchiveChange(objective),
                        'aria-label':
                            `${objective.status === 'archived' ? 'Restore' : 'Archive'} ${objective.objective_title || 'strategic objective'}`,
                    },
                    React.createElement('i', {
                        className:
                            objective.status === 'archived'
                                ? 'bi bi-arrow-counterclockwise'
                                : 'bi bi-archive',
                    })
                )
                : null,

            canDeleteObjectives
                ? React.createElement(
                    'button',
                    {
                        className:
                            'ui-button ui-button--danger ui-button--sm',
                        type: 'button',
                        disabled: archived,
                        onClick: () =>
                            requestDelete(objective),
                        'aria-label':
                            `Delete ${objective.objective_title || 'strategic objective'}`,
                    },
                    React.createElement('i', {
                        className: 'bi bi-trash3',
                    })
                )
                : null
        )
        : React.createElement(
            'span',
            { className: 'ui-help' },
            'Review only'
        )
)

)))
                ))), React.createElement(
    'div',
    { className: 'objectives-footer' },

    React.createElement(
        'span',
        null,
        `${objectives.length} Strategic Objective(s)`
    ),

    React.createElement(
        'nav',
        {
            className: 'objectives-pagination',
            'aria-label': 'Objectives pages',
        },

        React.createElement(
            'button',
            {
                className: 'ui-button ui-button--secondary ui-button--sm',
                type: 'button',
                disabled: currentPage === 1,
                onClick: () =>
                    setPage((value) => Math.max(1, value - 1)),
                'aria-label': 'Previous page',
            },
            React.createElement('i', {
                className: 'bi bi-chevron-left',
            })
        ),

        React.createElement(
            'span',
            { 'aria-live': 'polite' },
            `${currentPage} / ${totalPages}`
        ),

        React.createElement(
            'button',
            {
                className: 'ui-button ui-button--secondary ui-button--sm',
                type: 'button',
                disabled: currentPage === totalPages,
                onClick: () =>
                    setPage((value) =>
                        Math.min(totalPages, value + 1)
                    ),
                'aria-label': 'Next page',
            },
            React.createElement('i', {
                className: 'bi bi-chevron-right',
            })
        )
    )
)
            ),
            (canCreateObjectives || canUpdateObjectives) ? React.createElement('div', { className: 'objectives-page-actions' }, React.createElement('button', { className: 'ui-button ui-button--primary', type: 'button', onClick: () => setStatus({ type: 'info', message: 'Strategic Mapping is reserved for the next module.' }) }, 'Next: Strategic Mapping')) : null
        )),
        assigning ? React.createElement('div', { className: 'objective-modal-backdrop' },
            React.createElement('section', { className: 'objective-modal ui-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'assign-unit-title', onKeyDown: (event) => { if (event.key === 'Escape' && !submitting) setAssigning(null); } },
                React.createElement('div', { className: 'objective-modal__header' },
                    React.createElement('h2', { id: 'assign-unit-title' }, 'Assign Responsible Unit'),
                    React.createElement('button', { type: 'button', disabled: submitting, onClick: () => setAssigning(null), 'aria-label': 'Close assignment' }, '?')),
                React.createElement('div', { className: 'objective-modal__body' },
                    React.createElement('p', null, assigning.objective_title),
                    React.createElement('label', { className: 'ui-label', htmlFor: 'responsible-unit' }, 'Responsible Unit'),
                    React.createElement('input', { id: 'responsible-unit', className: 'ui-input', value: selectedUnit, list: 'responsible-unit-options', placeholder: 'Select or type the exact Office / Agency name', autoFocus: true, disabled: submitting, onChange: (event) => setSelectedUnit(event.target.value) }),
                    React.createElement('datalist', { id: 'responsible-unit-options' }, availableUnits.map((unit) => React.createElement('option', { key: unit, value: unit }))),
                    React.createElement('small', { className: 'ui-help' }, 'Use the exact Office / Agency account name to sync this objective.'),
                    assignmentError ? React.createElement('p', { className: 'ui-error', role: 'alert' }, assignmentError) : null),
                React.createElement('div', { className: 'objective-modal__actions' },
                    React.createElement('button', { type: 'button', className: 'ui-button ui-button--secondary', disabled: submitting, onClick: () => setAssigning(null) }, 'Cancel'),
                    React.createElement('button', { type: 'button', className: 'ui-button ui-button--primary', disabled: submitting || !selectedUnit, onClick: assignUnit }, submitting ? 'Assigning?' : 'Assign')))) : null,
        React.createElement(ObjectiveFormDialog, {
    open: formOpen,
    objective: editing,
    submitting,
    serverErrors: formErrors,
    onSave: saveObjective,
    onClose: () => {
        setFormOpen(false);
        setEditing(null);
    },
}),
       React.createElement(AppDialog, {
    open: dialog.open,
    variant: dialog.variant,
    title: dialog.title,
    message: dialog.message,
    confirmLabel:
        dialog.action === 'delete'
            ? 'Confirm Delete'
            : dialog.action === 'archive'
                ? 'Confirm Archive'
                : dialog.action === 'restore'
                    ? 'Confirm Restore'
                    : 'Continue',
    onConfirm:
        dialog.action === 'delete'
            ? confirmDelete
            : dialog.action === 'archive' ||
                dialog.action === 'restore'
                ? confirmArchiveChange
                : () =>
                    setDialog((current) => ({
                        ...current,
                        open: false,
                    })),
    onCancel: () =>
        setDialog((current) => ({
            ...current,
            open: false,
        })),
}) );
}

ReactDOM.createRoot(root).render(React.createElement(StrategicObjectivesApp));
