import { deleteStrategicObjective, listAllStrategicObjectives } from '../api/strategic-objectives-api.js';
import { AppSidebar } from '../components/AppSidebar.js';
import { AppDialog } from '../components/AppDialog.js';
import { enforcePageAccess } from '../access/access-guard.js';
import { PERMISSIONS } from '../access/access-policy.js';
import { can } from '../access/access-session.js';

enforcePageAccess();
const canManageObjectives = can(PERMISSIONS.PLANS_MANAGE);

const { useEffect, useState } = React;
const currentYear = new Date().getFullYear();

function StrategicObjectivesListApp() {
    const [objectives, setObjectives] = useState([]);
    const [filters, setFilters] = useState({ search: '', plan_id: '', status: '', responsible_office_agency: '', year: '' });
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState({ type: '', message: '' });
    const [dialog, setDialog] = useState({ open: false, variant: 'success', title: '', message: '', objective: null });

    async function load(targetPage = page, nextFilters = filters) {
        setLoading(true);
        try {
            const payload = await listAllStrategicObjectives({ ...nextFilters, page: targetPage });
            setObjectives(payload.data || []); setMeta(payload.meta || {}); setPage(targetPage);
        } catch (error) { setStatus({ type: 'error', message: error.message }); }
        finally { setLoading(false); }
    }
    useEffect(() => { load(1); }, []);

    function clearFilters() {
        const cleared = { search: '', plan_id: '', status: '', responsible_office_agency: '', year: '' };
        setFilters(cleared); load(1, cleared);
    }

    function requestDelete(objective) {
        setDialog({ open: true, variant: 'danger', title: 'Delete Strategic Objective?', message: `Delete “${objective.objective_title || 'Untitled objective'}”? This action cannot be undone.`, objective });
    }

    async function confirmDelete() {
        const objective = dialog.objective;
        setDialog((current) => ({ ...current, open: false })); setLoading(true);
        try { await deleteStrategicObjective(objective.objective_id); await load(page); setDialog({ open: true, variant: 'success', title: 'Operation successful', message: 'Strategic Objective deleted successfully.', objective: null }); }
        catch (error) { setDialog({ open: true, variant: 'error', title: 'Delete failed', message: error.message, objective: null }); setLoading(false); }
    }

    return React.createElement(React.Fragment, null,
        React.createElement(AppSidebar, { onNotice: (message) => setStatus({ type: 'info', message }) }),
        React.createElement('main', { className: 'app-shell-main manage-plans-page' }, React.createElement('div', { className: 'app-shell-container' },
            React.createElement('header', { className: 'app-page-header manage-plans-header' }, React.createElement('div', null, React.createElement('h1', { className: 'ui-page-title' }, 'Manage Strategic Objectives'), React.createElement('p', { className: 'ui-page-subtitle' }, 'View and maintain Strategic Objectives across all accessible Strategic Plans.'))),
            status.message ? React.createElement('div', { className: `ui-status ui-status--${status.type} plans-feedback`, role: 'status' }, status.message) : null,
            React.createElement('section', { className: 'ui-card plans-filter-card', 'aria-labelledby': 'objective-filter-title' }, React.createElement('div', { className: 'ui-card__body' }, React.createElement('h2', { className: 'plans-filter-title', id: 'objective-filter-title' }, 'Search and filter'), React.createElement('form', { className: 'plans-toolbar', onSubmit: (event) => { event.preventDefault(); load(1); } },
                React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'objective-search' }, 'Search'), React.createElement('div', { className: 'plans-search' }, React.createElement('input', { className: 'ui-input', id: 'objective-search', value: filters.search, placeholder: 'Search objectives', onChange: (event) => setFilters((current) => ({ ...current, search: event.target.value })) }), React.createElement('i', { className: 'bi bi-search' }))),
                React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'plan-id-filter' }, 'Plan ID'), React.createElement('input', { className: 'ui-input', id: 'plan-id-filter', type: 'number', min: 1, value: filters.plan_id, placeholder: 'All plans', onChange: (event) => setFilters((current) => ({ ...current, plan_id: event.target.value })) })),
                React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'objective-status' }, 'Status'), React.createElement('select', { className: 'ui-select', id: 'objective-status', value: filters.status, onChange: (event) => setFilters((current) => ({ ...current, status: event.target.value })) }, React.createElement('option', { value: '' }, 'All statuses'), React.createElement('option', { value: 'draft' }, 'Draft'), React.createElement('option', { value: 'published' }, 'Published'))),
                React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'responsible-office' }, 'Responsible Office'), React.createElement('input', { className: 'ui-input', id: 'responsible-office', value: filters.responsible_office_agency, placeholder: 'All offices', onChange: (event) => setFilters((current) => ({ ...current, responsible_office_agency: event.target.value })) })),
                React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'objective-year' }, 'Year'), React.createElement('select', { className: 'ui-select', id: 'objective-year', value: filters.year, onChange: (event) => setFilters((current) => ({ ...current, year: event.target.value })) }, React.createElement('option', { value: '' }, 'All years'), [0,1,2,3,4].map((offset) => React.createElement('option', { value: currentYear - offset, key: currentYear - offset }, currentYear - offset)))),
                React.createElement('div', { className: 'plans-filter-actions' }, React.createElement('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'submit', disabled: loading }, React.createElement('i', { className: 'bi bi-funnel-fill' }), 'Filter'), React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: clearFilters, disabled: loading }, 'Clear'))
            ))),
            React.createElement('section', { className: 'ui-card plans-card', 'aria-labelledby': 'objective-list-title' }, React.createElement('div', { className: 'plans-table-heading' }, React.createElement('h2', { id: 'objective-list-title' }, 'Strategic Objectives')), React.createElement('div', { className: 'ui-card__body' }, loading ? React.createElement('div', { className: 'ui-empty' }, 'Loading Strategic Objectives…') : objectives.length === 0 ? React.createElement('div', { className: 'ui-empty' }, 'No Strategic Objectives match the current filters.') : React.createElement('div', { className: 'ui-table-wrap' }, React.createElement('table', { className: 'ui-table plans-table' },
                React.createElement('thead', null, React.createElement('tr', null, ['Objective ID', 'Strategic Plan', 'Strategic Objective', 'Expected Outcome', 'Indicator', 'Target', 'Responsible Office/Agency', 'Status', 'Updated', 'Actions'].map((heading) => React.createElement('th', { key: heading }, heading)))),
                React.createElement('tbody', null, objectives.map((objective) => React.createElement('tr', { key: objective.objective_id }, React.createElement('td', null, React.createElement('span', { className: 'plans-id' }, `OBJ-${String(objective.objective_id).padStart(4, '0')}`)), React.createElement('td', null, React.createElement('a', { className: 'objective-plan-link', href: `/strategic-plans/${objective.strategic_plan_id}/objectives` }, objective.strategic_plan?.title || `Plan ${objective.strategic_plan_id}`)), React.createElement('td', { className: 'objective-title-cell' }, objective.objective_title || 'Untitled objective'), React.createElement('td', null, objective.expected_outcome || '—'), React.createElement('td', null, objective.indicator || '—'), React.createElement('td', null, objective.target || '—'), React.createElement('td', null, objective.responsible_office_agency || '—'), React.createElement('td', null, React.createElement('span', { className: `ui-badge ui-badge--${objective.status}` }, objective.status.replace(/^./, (letter) => letter.toUpperCase()))), React.createElement('td', null, objective.updated_at ? new Date(objective.updated_at).toLocaleDateString() : '—'), React.createElement('td', { className: 'objective-list-actions' }, canManageObjectives ? React.createElement('div', { className: 'ui-table__actions' }, React.createElement('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: `/strategic-plans/${objective.strategic_plan_id}/objectives?edit=${objective.objective_id}` }, React.createElement('i', { className: 'bi bi-pencil' }), 'Update'), React.createElement('button', { className: 'ui-button ui-button--danger ui-button--sm', type: 'button', onClick: () => requestDelete(objective) }, React.createElement('i', { className: 'bi bi-trash3' }), 'Delete')) : React.createElement('span', { className: 'ui-help' }, 'View only')))))
            ))), React.createElement('div', { className: 'plans-table-footer' }, React.createElement('span', null, `${meta.total || 0} Strategic Objective(s)`), React.createElement('div', { className: 'ui-pagination__actions' }, React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', disabled: loading || page <= 1, onClick: () => load(page - 1) }, '‹'), React.createElement('span', { className: 'plans-current-page' }, meta.current_page || 1), React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', disabled: loading || page >= (meta.last_page || 1), onClick: () => load(page + 1) }, '›'))))
        )),
        React.createElement(AppDialog, { open: dialog.open, variant: dialog.variant, title: dialog.title, message: dialog.message, confirmLabel: dialog.variant === 'danger' ? 'Confirm Delete' : 'Continue', onConfirm: dialog.variant === 'danger' ? confirmDelete : () => setDialog((current) => ({ ...current, open: false })), onCancel: () => setDialog((current) => ({ ...current, open: false })) })
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(StrategicObjectivesListApp));
