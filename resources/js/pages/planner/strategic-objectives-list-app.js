import {
    createStrategicObjective,
    getStrategicObjective,
    updateStrategicObjective,
    deleteStrategicObjective,
    listAllStrategicObjectives,
    assignResponsibleUnit,
    listResponsibleUnits,
    updateStrategicObjectiveStatus,
} from '../../api/strategic-objectives-api.js';
import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { ObjectiveFormDialog } from '../../strategic-objectives/ObjectiveFormDialog.js';
import { AssignUnitDialog } from '../../strategic-objectives/AssignUnitDialog.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { AppDialog } from '../../components/AppDialog.js';
import { PageHeader } from '../../components/PageHeader.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { PERMISSIONS } from '../../access/access-policy.js';
import { can, getAccessSession } from '../../access/access-session.js';
import { getAssignableUnits } from '../../objective-assignment-storage.js';

enforcePageAccess();

const canCreateObjectives = can(PERMISSIONS.OBJECTIVES_CREATE);

const canReviewObjectives = can(PERMISSIONS.OBJECTIVES_VIEW);

const canUpdateObjectives = can(PERMISSIONS.OBJECTIVES_UPDATE);

const canArchiveObjectives = can(PERMISSIONS.OBJECTIVES_ARCHIVE);

const canDeleteObjectives = can(PERMISSIONS.OBJECTIVES_DELETE);
const hasObjectiveActions =
    canReviewObjectives ||
    canUpdateObjectives ||
    canArchiveObjectives ||
    canDeleteObjectives;

const { useEffect, useState } = React;
const currentYear = new Date().getFullYear();


function displayName(user) {
    if (!user) return '';

    return user.name ||
        [user.first_name, user.last_name]
            .filter(Boolean)
            .join(' ');
}

function formatDate(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString();
}

function formatPlanId(objective) {
    const plan = objective.strategic_plan;
    const sourceDate = plan?.created_at || objective.created_at;
    const date = sourceDate ? new Date(sourceDate) : null;
    const year =
        date && !Number.isNaN(date.getTime())
            ? date.getFullYear()
            : currentYear;

    return `SP-${year}-${String(
        objective.strategic_plan_id
    ).padStart(3, '0')}`;
}

function StrategicObjectivesListApp() {
    const [objectives, setObjectives] = useState([]);
    const initialPlanId = new URLSearchParams(window.location.search).get('plan_id') || '';
    const [filters, setFilters] = useState({ search: '', plan_id: /^\d+$/.test(initialPlanId) ? initialPlanId : '', responsible_office_agency: '', year: '' });
    const [appliedFilters, setAppliedFilters] = useState(filters);
    const [plans, setPlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(canCreateObjectives);
    const [form, setForm] = useState({ open: false, objective: null, readOnly: false });
    const [formErrors, setFormErrors] = useState({});
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [assigning, setAssigning] = useState(null);
    const [assignmentError, setAssignmentError] = useState('');
    const [responsibleUnits, setResponsibleUnits] = useState([]);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [dialog, setDialog] = useState({
    open: false,
    variant: 'success',
    title: '',
    message: '',
    objective: null,
    action: null,
});

    async function load(targetPage = page, nextFilters = appliedFilters) {
        setLoading(true);
        try {
            const payload = await listAllStrategicObjectives({ ...nextFilters, page: targetPage });
            const lastPage = payload.meta?.last_page || 1;
            if (targetPage > lastPage) return await load(lastPage, nextFilters);
            setObjectives(payload.data || []); setMeta(payload.meta || {}); setPage(targetPage); setAppliedFilters(nextFilters);
        } catch (error) { setStatus({ type: 'error', message: error.message }); }
        finally { setLoading(false); }
    }
    useEffect(() => {
    load(1);

    listResponsibleUnits({ per_page: 100 })
        .then(payload =>
            setResponsibleUnits(
                (payload.data || []).map(
                    unit => unit.responsible_office_agency
                )
            )
        )
        .catch(error =>
            setStatus({
                type: 'error',
                message: error.message,
            })
        );

    if (canCreateObjectives) {
        loadPlanOptions();
    }

    const url = new URL(window.location.href);
    const editId = url.searchParams.get('edit');
    const createRequested =
        url.searchParams.get('create') === '1';

    let removeTemporaryParameter = false;

    if (
        editId &&
        /^\d+$/.test(editId) &&
        canReviewObjectives
    ) {
        getStrategicObjective(editId)
            .then(payload => openObjective(payload.data))
            .catch(error =>
                setStatus({
                    type: 'error',
                    message: error.message,
                })
            );

        url.searchParams.delete('edit');
        removeTemporaryParameter = true;
    } else if (
        createRequested &&
        canCreateObjectives &&
        /^\d+$/.test(initialPlanId)
    ) {
        setFormErrors({});
        setFormError('');

        setForm({
            open: true,
            objective: null,
            readOnly: false,
        });

        url.searchParams.delete('create');
        removeTemporaryParameter = true;
    }

    if (removeTemporaryParameter) {
        window.history.replaceState(
            {},
            '',
            `${url.pathname}${url.search}`
        );
    }
}, []);
    async function loadPlanOptions() {
        try {
            const first = await listStrategicPlans({ per_page: 100, page: 1 });
            const availablePlans = [...(first.data || [])];
            for (let nextPage = 2; nextPage <= (first.meta?.last_page || 1); nextPage += 1) {
                const payload = await listStrategicPlans({ per_page: 100, page: nextPage });
                availablePlans.push(...(payload.data || []));
            }
            setPlans(availablePlans);
        } catch (error) {
            setStatus({ type: 'error', message: error.message });
        } finally { setPlansLoading(false); }
    }

    function openObjective(objective) {
        const editable = canUpdateObjectives && objective.status !== 'archived' && objective.strategic_plan?.status !== 'archived';
        setFormErrors({});
        setFormError('');
        setForm({ open: true, objective, readOnly: !editable });
    }

    async function saveObjective(data) {
        if (form.readOnly || (form.objective ? !canUpdateObjectives : !canCreateObjectives)) return;
        setSubmitting(true); setFormErrors({}); setFormError('');
        try {
            if (form.objective) {
                await updateStrategicObjective(form.objective.objective_id, data);
            } else {
                await createStrategicObjective(data);
            }
            setForm({ open: false, objective: null, readOnly: false });
            // Clear narrowing filters so the saved objective is immediately visible.
            const nextFilters = { search: '', plan_id: String(form.objective?.strategic_plan_id || data.strategic_plan_id), responsible_office_agency: '', year: '' };
            setFilters(nextFilters);
            await load(1, nextFilters);
            setStatus({ type: 'success', message: form.objective ? 'Strategic Objective updated successfully.' : 'Strategic Objective added successfully.' });
        } catch (error) {
            setFormErrors(error.errors || {});
            setFormError(error.message || 'Unable to save the objective.');
        } finally { setSubmitting(false); }
    }

    async function assignUnit(unit) {
        if (!canUpdateObjectives || !assigning) return;
        setSubmitting(true); setAssignmentError('');
        try {
            const payload = await assignResponsibleUnit(assigning.objective_id, unit.trim());
            const updated = payload.data;
            setObjectives(current => current.map(objective => objective.objective_id === updated.objective_id ? updated : objective));
            setAssigning(null);
            setStatus({ type: 'success', message: `Objective assigned to ${unit}. It is now available in that Office / Agency view.` });
        } catch (error) {
            setAssignmentError(error.message || 'Unable to assign Responsible Unit.');
        } finally { setSubmitting(false); }
    }

    function clearFilters() {
        const cleared = { search: '', plan_id: '', responsible_office_agency: '', year: '' };
        window.history.replaceState({}, '', window.location.pathname);
        setFilters(cleared); load(1, cleared);
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
    if (!canArchiveObjectives) return;

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
    setLoading(true);

    try {
        await deleteStrategicObjective(objective.objective_id);
        await load(page);

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
        setLoading(false);
    }
}

async function confirmArchiveChange() {
    const objective = dialog.objective;
    const restoring = dialog.action === 'restore';

    setDialog((current) => ({ ...current, open: false }));
    setLoading(true);

    try {
        await updateStrategicObjectiveStatus(
            objective.objective_id,
            restoring ? 'restored' : 'archived'
        );

        await load(page);

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
        setLoading(false);
    }
}
    return React.createElement(React.Fragment, null,
        React.createElement(AppSidebar, { onNotice: (message) => setStatus({ type: 'info', message }) }),
        React.createElement('main', { className: 'app-shell-main manage-plans-page strategic-objectives-page' }, React.createElement('div', { className: 'app-shell-container' },
            React.createElement(PageHeader, { className: 'manage-plans-header', section: 'Strategic Planning', title: 'Strategic Objectives', subtitle: 'Create, review, update, and assign objectives across your strategic plans.',
                actions: canCreateObjectives ? React.createElement('button', { type: 'button', className: 'ui-button ui-button--primary manage-plans-create', disabled: loading || plansLoading, onClick: () => { setFormErrors({}); setFormError(''); setForm({ open: true, objective: null, readOnly: false }); } }, React.createElement('i', { className: 'bi bi-plus-lg' }), 'Add Objective') : null }),
            status.message ? React.createElement('div', { className: `ui-status ui-status--${status.type} plans-feedback`, role: 'status' }, status.message) : null,
            React.createElement('section', { className: 'ui-card plans-filter-card', 'aria-labelledby': 'objective-filter-title' },
                React.createElement('div', { className: 'plans-section-header' },
                    React.createElement('div', null,
                        React.createElement('h2', { className: 'plans-filter-title', id: 'objective-filter-title' }, 'Find strategic objectives'),
                        React.createElement('p', null, 'Search all accessible objectives or narrow the register using the available filters.')
                    ),
                    React.createElement('i', { className: 'bi bi-funnel', 'aria-hidden': 'true' })
                ),
                React.createElement('div', { className: 'ui-card__body' }, React.createElement('form', { className: 'plans-toolbar', onSubmit: (event) => { event.preventDefault(); load(1, filters); } },
                React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'objective-search' }, 'Search'), React.createElement('div', { className: 'plans-search' }, React.createElement('input', { className: 'ui-input', id: 'objective-search', value: filters.search, placeholder: 'Search objectives', onChange: (event) => setFilters((current) => ({ ...current, search: event.target.value })) }), React.createElement('i', { className: 'bi bi-search' }))),
                React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'plan-id-filter' }, 'Plan ID'), React.createElement('input', { className: 'ui-input', id: 'plan-id-filter', type: 'number', min: 1, value: filters.plan_id, placeholder: 'All plans', onChange: (event) => setFilters((current) => ({ ...current, plan_id: event.target.value })) })),
                React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'responsible-office' }, 'Responsible Office'), React.createElement('input', { className: 'ui-input', id: 'responsible-office', value: filters.responsible_office_agency, placeholder: 'All offices', onChange: (event) => setFilters((current) => ({ ...current, responsible_office_agency: event.target.value })) })),
                React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'objective-year' }, 'Year'), React.createElement('select', { className: 'ui-select', id: 'objective-year', value: filters.year, onChange: (event) => setFilters((current) => ({ ...current, year: event.target.value })) }, React.createElement('option', { value: '' }, 'All years'), [0,1,2,3,4].map((offset) => React.createElement('option', { value: currentYear - offset, key: currentYear - offset }, currentYear - offset)))),
                React.createElement('div', { className: 'plans-filter-actions' }, React.createElement('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'submit', disabled: loading }, React.createElement('i', { className: 'bi bi-funnel-fill' }), 'Filter'), React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: clearFilters, disabled: loading }, 'Clear'))
            ))),
            React.createElement('section', { className: 'ui-card plans-card', 'aria-labelledby': 'objective-list-title' }, React.createElement('div', { className: 'plans-table-heading' }, React.createElement('div', null, React.createElement('h2', { id: 'objective-list-title' }, 'Strategic Objective Register'), React.createElement('p', null, loading ? 'Loading the latest objective records…' : `${meta.total || 0} objective record(s) available`))), React.createElement('div', { className: 'ui-card__body' }, loading ? React.createElement('div', { className: 'ui-empty' }, 'Loading Strategic Objectives…') : objectives.length === 0 ? React.createElement('div', { className: 'ui-empty' }, 'No Strategic Objectives match the current filters.') :



            React.createElement(
    'div',
    {
        className:
            'ui-table-wrap',
    },
    React.createElement(
        'table',
        {
            className:
                'ui-table plans-table objective-list-table',
        },

        React.createElement(
            'thead',
            null,
            React.createElement(
                'tr',
                null,
                [
                    'Objective ID',
                    'Strategic Plan',
                    'Strategic Objective',
                    'Measurement',
                    'Responsible Office/Agency',
                    'Last Updated',
                    'Actions',
                ].map((heading) =>
                    React.createElement(
                        'th',
                        { key: heading },
                        heading
                    )
                )
            )
        ),

        React.createElement(
            'tbody',
            null,
            objectives.map((objective) => {
                const plan = objective.strategic_plan;
                const planStatus = plan?.status || 'draft';
                const canEditObjective = canUpdateObjectives
                    && objective.status !== 'archived'
                    && planStatus !== 'archived';
                const lastEditor =
                    objective.updater ||
                    objective.creator;
                const lastEditorName =
                    displayName(lastEditor);

                return React.createElement(
                    'tr',
                    { key: objective.objective_id },

                    React.createElement(
                        'td',
                        null,
                        React.createElement(
                            'span',
                            { className: 'plans-id' },
                            `OBJ-${String(
                                objective.objective_id
                            ).padStart(4, '0')}`
                        )
                    ),

                    React.createElement(
                        'td',
                        null,
                        React.createElement(
                            'div',
                            {
                                className:
                                    'objective-plan-summary',
                            },
                            React.createElement(
                                'button',
                                {
                                    className:
                                        'objective-plan-link',
                                    type: 'button',
                                    onClick: () => { const next = { ...appliedFilters, plan_id: String(objective.strategic_plan_id) }; setFilters(next); load(1, next); },
                                },
                                plan?.title ||
                                    `Plan ${objective.strategic_plan_id}`
                            ),
                            React.createElement(
                                'small',
                                null,
                                formatPlanId(objective)
                            ),

                        )
                    ),

                    React.createElement(
                        'td',
                        null,
                        React.createElement(
                            'div',
                            {
                                className:
                                    'objective-cell-summary',
                            },
                            React.createElement(
                                'button',
                                {
                                    type: 'button',
                                    className: 'objective-title-link',
                                    disabled: submitting,
                                    onClick: () =>
                                        openObjective(objective),
                                    'aria-label':
                                        `${canEditObjective ? 'Update' : 'Review'} ${
                                            objective.objective_title ||
                                            'strategic objective'
                                        }`,
                                },
                                objective.objective_title ||
                                    'Untitled objective'
                            ),
                            React.createElement(
                                'small',
                                null,
                                `Outcome: ${
                                    objective.expected_outcome ||
                                    '—'
                                }`
                            )
                        )
                    ),

                    React.createElement(
                        'td',
                        null,
                        React.createElement(
                            'div',
                            {
                                className:
                                    'objective-measurement',
                            },
                            React.createElement(
                                'span',
                                null,
                                React.createElement(
                                    'strong',
                                    null,
                                    'Indicator: '
                                ),
                                objective.indicator || '—'
                            ),

                        )
                    ),

                    React.createElement(
                        'td',
                        null,
                        objective.responsible_office_agency ||
                            '—'
                    ),

                    React.createElement(
                        'td',
                        null,
                        React.createElement(
                            'div',
                            {
                                className:
                                    'objective-updated-summary',
                            },
                            React.createElement(
                                'span',
                                null,
                                formatDate(
                                    objective.updated_at
                                )
                            ),
                            lastEditorName
                                ? React.createElement(
                                    'small',
                                    null,
                                    `by ${lastEditorName}`
                                )
                                : null
                        )
                    ),

                    React.createElement(
                        'td',
                        {
                            className:
                                'plans-actions-cell',
                        },
                        hasObjectiveActions
                            ? React.createElement(
                                'div',
                                {
                                    className:
                                        'ui-table__actions',
                                },
                                canEditObjective || canReviewObjectives ? React.createElement(
                                    'button',
                                    {
                                        className:
                                            'ui-button ui-button--secondary ui-button--sm',
                                        type: 'button',
                                        disabled: submitting,
                                        onClick: () => openObjective(objective),
                                        'aria-label':
                                            `${canEditObjective ? 'Update' : 'Review'} ${objective.objective_title || 'strategic objective'}`,
                                    },
                                    React.createElement('i', {
                                        className:
                                            canEditObjective ? 'bi bi-pencil' : 'bi bi-eye',
                                    }),
                                    canEditObjective ? 'Update' : 'Review'
                                ) : null,
                                canEditObjective ? React.createElement('button', {
                                    type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', disabled: submitting,
                                    onClick: () => { setAssigning(objective); setAssignmentError(''); },
                                    'aria-label': `Assign Responsible Unit to ${objective.objective_title || 'strategic objective'}`,
                                }, 'Assign') : null,

canArchiveObjectives
    ? React.createElement(
        'button',
        {
            className:
                'ui-button ui-button--secondary ui-button--sm',
            type: 'button',
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
        }),
        objective.status === 'archived'
            ? 'Restore'
            : 'Archive'
    )
    : null,



                                canDeleteObjectives ? React.createElement(
                                    'button',
                                    {
                                        className:
                                            'ui-button ui-button--danger ui-button--sm',
                                        type: 'button',
                                        onClick: () =>
                                            requestDelete(
                                                objective
                                            ),
                                    },
                                    React.createElement('i', {
                                        className:
                                            'bi bi-trash3',
                                    }),
                                    'Delete'
                                ) : null
                            )
                            : React.createElement(
                                'span',
                                { className: 'ui-help' },
                                'Review only'
                            )
                    )
                );
            })
        )
    )
), React.createElement('div', { className: 'plans-table-footer'
     }, React.createElement('span', null, `${meta.total || 0} Strategic Objective(s)`), React.createElement('div', { className: 'ui-pagination__actions' }, React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', disabled: loading || page <= 1, onClick: () => load(page - 1) }, '‹'), React.createElement('span', { className: 'plans-current-page' }, meta.current_page || 1), React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', disabled: loading || page >= (meta.last_page || 1), onClick: () => load(page + 1) }, '›'))))
        )),
        React.createElement(ObjectiveFormDialog, {
            open: form.open, objective: form.objective, readOnly: form.readOnly,
            plans, requirePlan: true, selectedPlanId: filters.plan_id,
            submitting, serverErrors: formErrors, submitError: formError,
            onSave: saveObjective,
            onClose: () => { if (!submitting) setForm({ open: false, objective: null, readOnly: false }); },
        }),
        React.createElement(AssignUnitDialog, {
            objective: assigning, submitting, error: assignmentError,
            availableUnits: getAssignableUnits(objectives, [getAccessSession()?.office, ...responsibleUnits]),
            onAssign: assignUnit, onClose: () => { if (!submitting) setAssigning(null); },
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
})
    ));
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(StrategicObjectivesListApp));
