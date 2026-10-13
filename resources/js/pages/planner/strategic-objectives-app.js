import { getStrategicPlan, updateStrategicPlan } from '../../api/strategic-plans-api.js';
import {
    createStrategicObjective, updateStrategicObjective, deleteStrategicObjective,
    listStrategicObjectives, assignResponsibleUnit, listResponsibleUnits, updateStrategicObjectiveStatus,
} from '../../api/strategic-objectives-api.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { AppDialog } from '../../components/AppDialog.js';
import { PageHeader } from '../../components/PageHeader.js';
import { ObjectiveProgressPanel } from '../../strategic-objectives/ObjectiveProgressPanel.js';
import { ObjectiveFormDialog } from '../../strategic-objectives/ObjectiveFormDialog.js';
import { AssignUnitDialog } from '../../strategic-objectives/AssignUnitDialog.js';
import { mountProtectedPage } from '../../access/mount-protected-page.js';
import { PERMISSIONS as P } from '../../access/access-policy.js';
import { can, getAccessSession } from '../../access/access-session.js';
import { getAssignableUnits } from '../../objective-assignment-storage.js';

const h = React.createElement;
const { useEffect, useState } = React;
const root = document.getElementById('root');
const planId = root.dataset.planId;
const pageSize = 10;
const errorText = error => [error.message, ...Object.values(error.errors || {}).flat()].filter(Boolean).join(' ');
function formatDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}
function displayName(user) { return user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' '); }

function StrategicObjectivesApp() {
    const canCreate = can(P.OBJECTIVES_CREATE), canUpdate = can(P.OBJECTIVES_UPDATE);
    const canArchive = can(P.OBJECTIVES_ARCHIVE), canDelete = can(P.OBJECTIVES_DELETE);
    const canMap = can('strategic_records.view') && can('strategic_objectives.view') && (can('relations.manage') || can('relations.create'));
    const [plan, setPlan] = useState(null), [objectives, setObjectives] = useState([]);
    const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
    const [busy, setBusy] = useState(false), [status, setStatus] = useState({ type: '', message: '' });
    const [notes, setNotes] = useState(''), [savedNotes, setSavedNotes] = useState('');
    const [form, setForm] = useState({ open: false, objective: null, readOnly: false });
    const [formErrors, setFormErrors] = useState({}), [formError, setFormError] = useState('');
    const [assigning, setAssigning] = useState(null), [assignmentError, setAssignmentError] = useState('');
    const [units, setUnits] = useState([]), [page, setPage] = useState(1);
    const [confirmation, setConfirmation] = useState(null);
    const navigating = React.useRef(false);
    const mutable = Boolean(plan && !['archived', 'deleted'].includes(plan.status));
    const canSaveNotes = plan?.status === 'draft' && can(P.PLANS_UPDATE);
    const notesDirty = notes !== savedNotes;
    const pageCount = Math.max(1, Math.ceil(objectives.length / pageSize));
    const currentPage = Math.min(page, pageCount);
    const visible = objectives.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    async function load() {
        setLoading(true); setLoadError('');
        try {
            const [planResult, objectiveResult] = await Promise.all([getStrategicPlan(planId), listStrategicObjectives(planId)]);
            const loaded = planResult.data;
            const items = objectiveResult.data || [];
            setPlan(loaded); setObjectives(items);
            setNotes(loaded.description || ''); setSavedNotes(loaded.description || '');
            const url = new URL(window.location.href);
            const editId = url.searchParams.get('edit');
            const editablePlan = !['archived', 'deleted'].includes(loaded.status);
            if (editId) {
                const objective = items.find(item => String(item.objective_id) === editId);
                if (objective) setForm({ open: true, objective, readOnly: !canUpdate || !editablePlan || objective.status === 'archived' });
                else setStatus({ type: 'error', message: 'This objective is not available in the selected plan.' });
            } else if (url.searchParams.get('create') === '1' && canCreate && editablePlan) {
                setForm({ open: true, objective: null, readOnly: false });
            }
            url.searchParams.delete('edit'); url.searchParams.delete('create');
            window.history.replaceState({}, '', url.pathname + url.search);
        } catch (error) { setLoadError(errorText(error)); }
        finally { setLoading(false); }
    }
    useEffect(() => {
        load();
        if (canUpdate) listResponsibleUnits({ per_page: 100 }).then(result => setUnits((result.data || []).map(unit => unit.responsible_office_agency)))
            .catch(error => setStatus({ type: 'info', message: `Office suggestions could not load: ${error.message}. You can still enter the exact Office / Agency name.` }));
    }, []);
    useEffect(() => {
        if (!notesDirty) return;
        const warn = event => { if (navigating.current) return; event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        window.addEventListener('app:before-navigate', warn);
        return () => {
            window.removeEventListener('beforeunload', warn);
            window.removeEventListener('app:before-navigate', warn);
        };
    }, [notesDirty]);
    async function refreshObjectives() {
        const result = await listStrategicObjectives(planId);
        setObjectives(result.data || []);
        return result.data || [];
    }
    function openObjective(objective = null) {
        setFormErrors({}); setFormError('');
        setForm({ open: true, objective, readOnly: objective ? !canUpdate || !mutable || objective.status === 'archived' : false });
    }
    async function saveObjective(data) {
        if (!mutable || busy || form.readOnly || (form.objective ? !canUpdate : !canCreate)) return;
        setBusy(true); setFormErrors({}); setFormError('');
        try {
            const editing = form.objective;
            const result = editing ? await updateStrategicObjective(editing.objective_id, data)
                : await createStrategicObjective({ ...data, strategic_plan_id: Number(planId) });
            setForm({ open: false, objective: null, readOnly: false });
            setStatus({ type: 'success', message: editing ? 'Objective updated.' : 'Objective added to this plan.' });
            try {
                const items = await refreshObjectives();
                const index = items.findIndex(item => item.objective_id === result.data?.objective_id);
                if (index >= 0) setPage(Math.floor(index / pageSize) + 1);
            } catch (error) { setStatus({ type: 'error', message: `The objective was saved, but the list could not refresh: ${error.message}` }); }
        } catch (error) { setFormErrors(error.errors || {}); setFormError(error.message); }
        finally { setBusy(false); }
    }
    async function assignUnit(unit) {
        if (!canUpdate || !mutable || busy || !assigning) return;
        setBusy(true); setAssignmentError('');
        try {
            const result = await assignResponsibleUnit(assigning.objective_id, unit);
            setObjectives(items => items.map(item => item.objective_id === result.data.objective_id ? result.data : item));
            setAssigning(null); setStatus({ type: 'success', message: `Objective assigned to ${unit}.` });
        } catch (error) { setAssignmentError(errorText(error)); }
        finally { setBusy(false); }
    }
    async function confirmAction() {
        if (!confirmation || busy || !mutable) return;
        const { objective, action } = confirmation;
        if ((action === 'delete' && !canDelete) || (action !== 'delete' && !canArchive)) return;
        setBusy(true);
        try {
            if (action === 'delete') await deleteStrategicObjective(objective.objective_id);
            else await updateStrategicObjectiveStatus(objective.objective_id, action === 'restore' ? 'restored' : 'archived');
            setConfirmation(null);
            setStatus({ type: 'success', message: `Objective ${action === 'delete' ? 'deleted' : action === 'restore' ? 'restored' : 'archived'}.` });
            try { await refreshObjectives(); }
            catch (error) { setStatus({ type: 'error', message: `The change was saved, but the list could not refresh: ${error.message}` }); }
        } catch (error) { setConfirmation(null); setStatus({ type: 'error', message: errorText(error) }); }
        finally { setBusy(false); }
    }
    async function saveDraft(goNext = false) {
        if (busy || !plan || (goNext && !canMap)) return;
        if (!canSaveNotes && !goNext) return;
        setBusy(true); setStatus({ type: '', message: '' });
        try {
            if (canSaveNotes && (!goNext || notesDirty)) {
                // The existing update endpoint replaces the plan payload. Preserve fresh MVC and dates.
                const { data: latest } = await getStrategicPlan(planId);
                if (latest.status !== 'draft') throw new Error('This plan is no longer a draft. Reload it before saving notes.');
                const result = await updateStrategicPlan(planId, {
                    title: latest.title, level: latest.level, description: notes.trim() || null,
                    mission: latest.mission_foundation?.content || '', vision: latest.vision_foundation?.content || '',
                    core_values: (latest.core_values || []).map(value => value.content),
                    planning_start_date: latest.planning_start_date, planning_end_date: latest.planning_end_date,
                    department_agency: latest.department_agency, status: 'draft',
                });
                setPlan(result.data); setNotes(result.data.description || ''); setSavedNotes(result.data.description || '');
                setStatus({ type: 'success', message: 'Draft notes saved. Objectives are saved when you submit each objective form.' });
            }
            if (goNext) { navigating.current = true; window.location.assign(`/mappings?plan_id=${planId}`); }
        } catch (error) { setStatus({ type: 'error', message: errorText(error) }); }
        finally { setBusy(false); }
    }
    const summary = (label, value) => h('div', { className: 'plan-summary-item', key: label }, h('span', null, label), h('strong', null, value || '—'));
    const iconButton = (label, icon, onClick, danger = false, disabled = false) => h('button', {
        type: 'button', className: `ui-button ui-button--${danger ? 'danger' : 'secondary'} ui-button--sm`, title: label, 'aria-label': label,
        onClick, disabled: busy || disabled,
    }, h('i', { className: `bi ${icon}`, 'aria-hidden': true }));
    const updatedBy = displayName(plan?.updater) || displayName(plan?.creator);
    const planYear = plan?.created_at ? new Date(plan.created_at).getFullYear() : new Date().getFullYear();
    return h(React.Fragment, null, h(AppSidebar),
        h('main', { className: 'app-shell-main objectives-page' }, h('div', { className: 'app-shell-container' },
            h('a', { className: 'objectives-back', href: '/strategic-objectives' }, '← Choose another plan'),
            h(PageHeader, { className: 'objectives-header', section: 'Strategic Planning', title: 'Add Strategic Objectives', subtitle: 'Define strategic objectives, expected outcomes, indicators, and targets for the plan.' }),
            status.message && h('div', { className: `ui-status ui-status--${status.type}`, role: status.type === 'error' ? 'alert' : 'status' }, status.message),
            loadError && h('div', { className: 'ui-status ui-status--error', role: 'alert' }, loadError, ' ', h('button', { type: 'button', className: 'ui-button ui-button--secondary', onClick: load }, 'Retry')),
            loading && h('p', { role: 'status' }, 'Loading plan and objectives…'),
            plan && h(React.Fragment, null,
                !mutable && h('p', { className: 'ui-status ui-status--info' }, 'This plan is read-only. Restore an archived plan before editing its objectives.'),
                h('section', { className: 'ui-card plan-summary', 'aria-labelledby': 'plan-summary-title' },
                    h('div', { className: 'ui-card__header' }, h('h2', { className: 'ui-card__title', id: 'plan-summary-title' }, 'Plan Summary')),
                    h('div', { className: 'ui-card__body plan-summary-grid' },
                        summary('Plan ID', `SP-${planYear}-${String(plan.record_id).padStart(3, '0')}`), summary('Plan Title', plan.title),
                        summary('Plan period', `${formatDate(plan.planning_start_date)} – ${formatDate(plan.planning_end_date)}`),
                        summary('Department/Agency', plan.department_agency || plan.creator?.department || plan.creator?.office),
                        summary('Last Updated', h(React.Fragment, null, formatDate(plan.updated_at), updatedBy && h('small', null, `by ${updatedBy}`))))),
                h('section', { className: 'ui-card objectives-card', 'aria-labelledby': 'objectives-title' },
                    h('div', { className: 'objectives-heading' }, h('h2', { id: 'objectives-title' }, 'Strategic Objectives'),
                        canCreate && h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', disabled: !mutable || loading || busy, onClick: () => openObjective() }, h('i', { className: 'bi bi-plus-lg', 'aria-hidden': true }), 'Add Objective')),
                    h('div', { className: 'ui-card__body' }, h('div', { className: 'ui-table-wrap' }, h('table', { className: 'ui-table objectives-table' },
                        h('thead', null, h('tr', null, ['No.', 'Objectives', 'Expected outcome', 'Indicator', 'Target', 'Responsible Office/Agency', 'Actions'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                        h('tbody', null, !visible.length ? h('tr', null, h('td', { colSpan: 7 }, 'No objectives yet. Add an objective to this plan.')) : visible.map((objective, index) => h('tr', { key: objective.objective_id },
                            h('td', null, (currentPage - 1) * pageSize + index + 1),
                            h('td', null, objective.objective_title || 'Untitled objective', objective.status === 'archived' && h('small', { className: 'ui-help' }, ' · Archived')),
                            h('td', null, objective.expected_outcome || '—'), h('td', null, objective.indicator || '—'), h('td', null, objective.target || '—'),
                            h('td', null, objective.responsible_office_agency || 'Unassigned'),
                            h('td', null, h('div', { className: 'objectives-table__actions' },
                                iconButton(`${canUpdate && mutable && objective.status !== 'archived' ? 'Edit' : 'Review'} ${objective.objective_title}`, canUpdate && mutable && objective.status !== 'archived' ? 'bi-pencil' : 'bi-eye', () => openObjective(objective)),
                                canUpdate && iconButton(`Assign ${objective.objective_title}`, 'bi-person-plus', () => { setAssigning(objective); setAssignmentError(''); }, false, !mutable || objective.status === 'archived'),
                                canArchive && iconButton(`${objective.status === 'archived' ? 'Restore' : 'Archive'} ${objective.objective_title}`, objective.status === 'archived' ? 'bi-arrow-counterclockwise' : 'bi-archive', () => setConfirmation({ objective, action: objective.status === 'archived' ? 'restore' : 'archive' }), false, !mutable),
                                canDelete && iconButton(`Delete ${objective.objective_title}`, 'bi-trash3', () => setConfirmation({ objective, action: 'delete' }), true, !mutable)))))))),
                        h('div', { className: 'objectives-notes ui-field' }, h('label', { className: 'ui-label', htmlFor: 'plan-notes' }, 'Notes/Comment'),
                            h('textarea', { id: 'plan-notes', className: 'ui-textarea', rows: 3, value: notes, readOnly: !canSaveNotes, disabled: busy, placeholder: 'Input description or notes for this plan', onChange: event => setNotes(event.target.value) }),
                            h('small', { className: 'ui-help' }, canSaveNotes ? 'Saved with the plan’s Description/Notes. Objective changes are saved separately.' : 'Plan notes are read-only for this plan or account.')),
                        h('div', { className: 'objectives-footer' }, h('span', null, `${objectives.length} objective(s)`),
                            h('nav', { className: 'objectives-pagination', 'aria-label': 'Objectives pages' },
                                iconButton('Previous page', 'bi-chevron-left', () => setPage(currentPage - 1), false, currentPage <= 1),
                                h('span', { 'aria-live': 'polite' }, `${currentPage} / ${pageCount}`),
                                iconButton('Next page', 'bi-chevron-right', () => setPage(currentPage + 1), false, currentPage >= pageCount))))),
                h('div', { className: 'objectives-page-actions' },
                    h('button', { className: 'ui-button ui-button--secondary', type: 'button', disabled: busy || loading || !canSaveNotes, onClick: () => saveDraft() }, busy ? 'Saving…' : 'Save as a draft'),
                    h('button', { className: 'ui-button ui-button--primary', type: 'button', disabled: busy || loading || !mutable || !canMap, onClick: () => saveDraft(true) }, 'Next: Strategic Mapping')),
                can(P.OBJECTIVES_VIEW_PROGRESS) && h('details', { className: 'objectives-progress' }, h('summary', null, 'Monitor and update progress'), h(ObjectiveProgressPanel, { planId }))))),
        h(ObjectiveFormDialog, { open: form.open, objective: form.objective, readOnly: form.readOnly, submitting: busy, serverErrors: formErrors, submitError: formError, planLabel: plan?.title, onSave: saveObjective, onClose: () => { if (!busy) setForm({ open: false, objective: null, readOnly: false }); } }),
        h(AssignUnitDialog, { objective: assigning, submitting: busy, error: assignmentError, availableUnits: getAssignableUnits(objectives, [getAccessSession()?.office, ...units]), onAssign: assignUnit, onClose: () => { if (!busy) setAssigning(null); } }),
        h(AppDialog, { open: Boolean(confirmation), variant: confirmation?.action === 'restore' ? 'success' : 'danger', title: `${confirmation?.action || ''} objective?`, message: confirmation ? `${confirmation.action === 'delete' ? 'Permanently delete' : confirmation.action} “${confirmation.objective.objective_title}”?` : '', confirmLabel: busy ? 'Saving…' : 'Confirm', onConfirm: confirmAction, onCancel: () => { if (!busy) setConfirmation(null); } }));
}

mountProtectedPage(root, () => h(StrategicObjectivesApp));
