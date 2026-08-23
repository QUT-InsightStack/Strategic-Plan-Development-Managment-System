import { getStrategicPlan } from '../api/strategic-plans-api.js';
import { createStrategicObjective, deleteStrategicObjective, listStrategicObjectives, updateStrategicObjective } from '../api/strategic-objectives-api.js';
import { AppSidebar } from '../components/AppSidebar.js';
import { AppDialog } from '../components/AppDialog.js';
import { ObjectiveFormDialog } from '../strategic-objectives/ObjectiveFormDialog.js';
import { enforcePageAccess } from '../access/access-guard.js';
import { PERMISSIONS } from '../access/access-policy.js';
import { can } from '../access/access-session.js';

enforcePageAccess();
const canManageObjectives = can(PERMISSIONS.PLANS_MANAGE);

const { useEffect, useState } = React;
const root = document.getElementById('root');
const planId = root.dataset.planId;

function StrategicObjectivesApp() {
    const [plan, setPlan] = useState(null);
    const [objectives, setObjectives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formOpen, setFormOpen] = useState(false);
    const [formErrors, setFormErrors] = useState({});
    const [status, setStatus] = useState({ type: '', message: '' });
    const [dialog, setDialog] = useState({ open: false, variant: 'success', title: '', message: '', objective: null });

    async function load() {
        setLoading(true);
        try {
            const [planPayload, objectivesPayload] = await Promise.all([getStrategicPlan(planId), listStrategicObjectives(planId)]);
            setPlan(planPayload.data); setObjectives(objectivesPayload.data || []);
            const editId = new URLSearchParams(window.location.search).get('edit');
            if (editId) {
                const objectiveToEdit = (objectivesPayload.data || []).find((item) => String(item.objective_id) === editId);
                if (objectiveToEdit) { setEditing(objectiveToEdit); setFormOpen(true); }
                window.history.replaceState({}, '', window.location.pathname);
            }
        } catch (error) { setStatus({ type: 'error', message: error.message }); }
        finally { setLoading(false); }
    }

    useEffect(() => { load(); }, []);

    async function saveObjective(data) {
        setSubmitting(true); setFormErrors({});
        try {
            const payload = editing
                ? await updateStrategicObjective(editing.objective_id, data)
                : await createStrategicObjective({ ...data, strategic_plan_id: Number(planId) });
            setFormOpen(false); setEditing(null); await load();
            setDialog({ open: true, variant: 'success', title: 'Operation successful', message: editing ? 'Strategic Objective updated successfully.' : 'Strategic Objective added successfully.', objective: null });
            return payload;
        } catch (error) { setFormErrors(error.errors || {}); setStatus({ type: 'error', message: error.message }); }
        finally { setSubmitting(false); }
    }

    function requestDelete(objective) {
        setDialog({ open: true, variant: 'danger', title: 'Delete Strategic Objective?', message: `Delete “${objective.objective_title || 'Untitled objective'}”? This action cannot be undone.`, objective });
    }

    async function confirmDelete() {
        const objective = dialog.objective;
        setDialog((current) => ({ ...current, open: false })); setSubmitting(true);
        try { await deleteStrategicObjective(objective.objective_id); await load(); setDialog({ open: true, variant: 'success', title: 'Operation successful', message: 'Strategic Objective deleted successfully.', objective: null }); }
        catch (error) { setDialog({ open: true, variant: 'error', title: 'Delete failed', message: error.message, objective: null }); }
        finally { setSubmitting(false); }
    }

    const archived = plan?.status === 'archived';

    return React.createElement(React.Fragment, null,
        React.createElement(AppSidebar, { onNotice: (message) => setStatus({ type: 'info', message }) }),
        React.createElement('main', { className: 'app-shell-main objectives-page' }, React.createElement('div', { className: 'app-shell-container' },
            React.createElement('header', { className: 'app-page-header objectives-header' }, React.createElement('div', null, React.createElement('h1', { className: 'ui-page-title' }, 'Add Strategic Objectives'), React.createElement('p', { className: 'ui-page-subtitle' }, 'Define measurable objectives, expected outcomes, indicators, targets, and accountable offices for this strategic plan.'))),
            status.message ? React.createElement('div', { className: `ui-status ui-status--${status.type}`, role: 'status' }, status.message) : null,
            archived ? React.createElement('div', { className: 'ui-status ui-status--error' }, 'This Strategic Plan is archived. Restore it before changing its objectives.') : null,
            React.createElement('section', { className: 'ui-card plan-summary', 'aria-labelledby': 'plan-summary-title' }, React.createElement('div', { className: 'ui-card__header' }, React.createElement('h2', { className: 'ui-card__title', id: 'plan-summary-title' }, 'Plan Summary')), React.createElement('div', { className: 'ui-card__body plan-summary-grid' },
                React.createElement('div', { className: 'plan-summary-item' }, React.createElement('span', null, 'Plan ID'), React.createElement('strong', null, plan ? `SP-${String(plan.record_id).padStart(4, '0')}` : '—')),
                React.createElement('div', { className: 'plan-summary-item' }, React.createElement('span', null, 'Plan Title'), React.createElement('strong', null, plan?.title || 'Loading…')),
                React.createElement('div', { className: 'plan-summary-item' }, React.createElement('span', null, 'Plan Period'), React.createElement('strong', null, 'Not available')),
                React.createElement('div', { className: 'plan-summary-item' }, React.createElement('span', null, 'Department/Agency'), React.createElement('strong', null, plan?.creator?.department || 'Not available')),
                React.createElement('div', { className: 'plan-summary-item' }, React.createElement('span', null, 'Last Updated'), React.createElement('strong', null, plan?.updated_at ? new Date(plan.updated_at).toLocaleDateString() : '—'))
            )),
            React.createElement('section', { className: 'ui-card objectives-card', 'aria-labelledby': 'objectives-title' },
                React.createElement('div', { className: 'objectives-heading' }, React.createElement('h2', { id: 'objectives-title' }, 'Strategic Objectives'), canManageObjectives ? React.createElement('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', disabled: archived || loading, onClick: () => { setEditing(null); setFormOpen(true); } }, React.createElement('i', { className: 'bi bi-plus-lg' }), 'Add Objective') : null),
                React.createElement('div', { className: 'ui-card__body' }, loading ? React.createElement('div', { className: 'ui-empty' }, 'Loading Strategic Objectives…') : objectives.length === 0 ? React.createElement('div', { className: 'ui-empty' }, 'No Strategic Objectives have been added yet.') : React.createElement('div', { className: 'ui-table-wrap' }, React.createElement('table', { className: 'ui-table objectives-table' },
                    React.createElement('thead', null, React.createElement('tr', null, ['No.', 'Strategic Objective', 'Expected Outcome', 'Indicator', 'Target', 'Responsible Office/Agency', 'Actions'].map((heading) => React.createElement('th', { key: heading }, heading)))),
                    React.createElement('tbody', null, objectives.map((objective, index) => React.createElement('tr', { key: objective.objective_id }, React.createElement('td', null, index + 1), React.createElement('td', null, objective.objective_title || 'Untitled objective'), React.createElement('td', null, objective.expected_outcome || '—'), React.createElement('td', null, objective.indicator || '—'), React.createElement('td', null, objective.target || '—'), React.createElement('td', null, objective.responsible_office_agency || '—'), React.createElement('td', null, canManageObjectives ? React.createElement('div', { className: 'objectives-table__actions' }, React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: archived, onClick: () => { setEditing(objective); setFormOpen(true); }, 'aria-label': `Update ${objective.objective_title}` }, React.createElement('i', { className: 'bi bi-pencil' })), React.createElement('button', { className: 'ui-button ui-button--danger ui-button--sm', type: 'button', disabled: archived, onClick: () => requestDelete(objective), 'aria-label': `Delete ${objective.objective_title}` }, React.createElement('i', { className: 'bi bi-trash3' }))) : React.createElement('span', { className: 'ui-help' }, 'View only')))))
                ))), React.createElement('div', { className: 'objectives-footer' }, `${objectives.length} Strategic Objective(s)`)
            ),
            canManageObjectives ? React.createElement('div', { className: 'objectives-page-actions' }, React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: () => setDialog({ open: true, variant: 'success', title: 'Draft saved', message: 'All current Strategic Objectives are saved as draft.', objective: null }) }, 'Save as Draft'), React.createElement('button', { className: 'ui-button ui-button--primary', type: 'button', onClick: () => setStatus({ type: 'info', message: 'Strategic Mapping is reserved for the next module.' }) }, 'Next: Strategic Mapping')) : null
        )),
        React.createElement(ObjectiveFormDialog, { open: formOpen, objective: editing, submitting, serverErrors: formErrors, onSave: saveObjective, onClose: () => { setFormOpen(false); setEditing(null); } }),
        React.createElement(AppDialog, { open: dialog.open, variant: dialog.variant, title: dialog.title, message: dialog.message, confirmLabel: dialog.variant === 'danger' ? 'Confirm Delete' : 'Continue', onConfirm: dialog.variant === 'danger' ? confirmDelete : () => setDialog((current) => ({ ...current, open: false })), onCancel: () => setDialog((current) => ({ ...current, open: false })) })
    );
}

ReactDOM.createRoot(root).render(React.createElement(StrategicObjectivesApp));
