import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { getStrategicObjective, listAllStrategicObjectives, listResponsibleUnits } from '../../api/strategic-objectives-api.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { useDialogBehaviour } from '../../components/use-dialog-behaviour.js';
import { mountProtectedPage } from '../../access/mount-protected-page.js';
import { PERMISSIONS as P } from '../../access/access-policy.js';
import { can } from '../../access/access-session.js';

const h = React.createElement;
const { useEffect, useState } = React;
const pageSize = 10;
const EMPTY_FILTERS = Object.freeze({ search: '', plan_id: '', responsible_office_agency: '', status: '' });
const STATUS_LABELS = { draft: 'Draft', published: 'Published', archived: 'Archived' };
const isId = value => /^[1-9][0-9]*$/.test(value || '');

function formatDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}
function displayName(user) { return user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' '); }
function officeName(objective) {
    return objective.responsible_unit_assignment?.responsible_unit?.responsible_office_agency || objective.responsible_office_agency || '';
}
// Approved and archived plans are final, so their objectives are only reviewed here.
function planIsEditable(plan) {
    return Boolean(plan) && !['archived', 'deleted'].includes(plan.status) && plan.approval_status !== 'approved';
}
function objectivePageUrl(planId, params = new URLSearchParams()) {
    const query = new URLSearchParams();
    if (isId(params.get('edit'))) query.set('edit', params.get('edit'));
    if (params.get('create') === '1') query.set('create', '1');
    return `/strategic-plans/${planId}/objectives${query.size ? `?${query}` : ''}`;
}

// Read-only view of one objective. Accounts that maintain objectives can continue to the plan's
// Add Strategic Objectives page, where all editing lives (strategic-objectives-app.js).
function ObjectiveViewDialog({ objective, plan, onClose }) {
    const dialogRef = useDialogBehaviour(Boolean(objective), onClose);
    if (!objective) return null;
    const planId = objective.strategic_plan_id;
    const canMaintain = (can(P.OBJECTIVES_CREATE) || can(P.OBJECTIVES_UPDATE)) && planIsEditable(plan || objective.strategic_plan);
    const detail = (label, value) => h('div', { className: 'objective-view__item', key: label }, h('dt', null, label), h('dd', null, value || '—'));
    const list = items => items?.length ? h('ul', null, items.map((item, index) => h('li', { key: index }, item))) : null;
    return h('div', { className: 'objective-modal-backdrop' },
        h('section', { ref: dialogRef, className: 'objective-modal ui-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'objective-view-title' },
            h('div', { className: 'objective-modal__header' },
                h('h2', { id: 'objective-view-title' }, 'View Strategic Objective'),
                h('button', { type: 'button', onClick: onClose, 'aria-label': 'Close objective view' }, '×')),
            h('dl', { className: 'objective-modal__body objective-view' },
                detail('Strategic Plan', objective.strategic_plan?.title || plan?.title),
                detail('Strategic Objective', objective.objective_title),
                detail('Description', objective.objective_description),
                detail('Expected outcome', objective.expected_outcome),
                detail('Indicator', objective.indicator),
                detail('Target', objective.target),
                detail('Responsible Office/Agency', officeName(objective) || 'Unassigned'),
                detail('Status', h('span', { className: `ui-badge ui-badge--${objective.status}` }, STATUS_LABELS[objective.status] || objective.status)),
                objective.progress_percentage != null && detail('Progress', `${objective.progress_percentage}%`),
                detail('PDP Chapters', list(objective.pdp_chapters?.map(chapter => chapter.chapter_title))),
                detail('Presidential Agenda', list(objective.presidential_agenda_items?.map(item => [item.code, item.title].filter(Boolean).join(' · ')))),
                detail('Last updated', [formatDate(objective.updated_at), displayName(objective.updater || objective.creator)].filter(Boolean).join(' by '))),
            h('div', { className: 'objective-modal__actions' },
                h('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: onClose }, 'Close'),
                canMaintain && h('a', { className: 'ui-button ui-button--primary', href: objectivePageUrl(planId) },
                    h('i', { className: 'bi bi-pencil-square', 'aria-hidden': true }), ' Open in Add Strategic Objectives'))));
}

function StrategicObjectivesListApp() {
    const canCreate = can(P.OBJECTIVES_CREATE), canMaintain = canCreate || can(P.OBJECTIVES_UPDATE);
    const [plans, setPlans] = useState([]), [offices, setOffices] = useState([]);
    const [objectives, setObjectives] = useState([]), [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
    const [viewing, setViewing] = useState(null);
    const hasFilters = Object.keys(EMPTY_FILTERS).some(key => filters[key]);
    const selectedPlan = plans.find(plan => String(plan.record_id) === filters.plan_id);

    async function load(nextFilters = filters, page = 1) {
        setLoading(true); setError('');
        try {
            const result = await listAllStrategicObjectives({ ...nextFilters, page, per_page: pageSize });
            setObjectives(result.data || []);
            setMeta(result.meta || { current_page: page, last_page: 1, total: (result.data || []).length });
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    }
    function applyFilter(key, value) {
        const next = { ...filters, [key]: value };
        setFilters(next); setNotice('');
        load(next);
    }
    function resetFilters() { setFilters(EMPTY_FILTERS); setNotice(''); load(EMPTY_FILTERS); }

    useEffect(() => {
        let active = true;
        async function start() {
            const query = new URLSearchParams(window.location.search);
            // Old deep links that asked to create or edit still open the plan's objective editor.
            if (isId(query.get('plan_id')) && (query.get('create') === '1' || isId(query.get('edit')))) {
                window.location.replace(objectivePageUrl(query.get('plan_id'), query));
                return;
            }
            if (isId(query.get('edit'))) {
                try {
                    const result = await getStrategicObjective(query.get('edit'));
                    if (active) window.location.replace(objectivePageUrl(result.data.strategic_plan_id, query));
                    return;
                } catch (err) { if (active) setNotice(`That objective could not be opened: ${err.message}`); }
            }
            const initial = isId(query.get('plan_id')) ? { ...EMPTY_FILTERS, plan_id: query.get('plan_id') } : EMPTY_FILTERS;
            if (active) setFilters(initial);
            load(initial);
            // Filter options are optional: the list still works if either source is unavailable.
            try {
                const all = [];
                let page = 1, last = 1;
                do {
                    const result = await listStrategicPlans({ per_page: 100, page });
                    all.push(...(result.data || []));
                    last = result.meta?.last_page || 1;
                    page++;
                } while (active && page <= last);
                if (active) setPlans(all.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''))));
            } catch { /* The plan filter stays at "All plans". */ }
            try {
                const result = await listResponsibleUnits({ per_page: 100 });
                const names = (result.data || []).map(unit => unit.responsible_office_agency).filter(Boolean);
                if (active) setOffices([...new Set(names)].sort());
            } catch { /* The office filter is hidden. */ }
        }
        start();
        return () => { active = false; };
    }, []);

    // Accounts that maintain objectives go straight to the plan's Add Strategic Objectives page with the
    // objective open; everyone else, and objectives of approved or archived plans, get the read-only view.
    function openObjective(objective) {
        const plan = plans.find(item => item.record_id === objective.strategic_plan_id) || objective.strategic_plan;
        if (canMaintain && planIsEditable(plan)) {
            window.location.assign(objectivePageUrl(objective.strategic_plan_id, new URLSearchParams(`edit=${objective.objective_id}`)));
            return;
        }
        setViewing(objective);
    }

    function addObjective() {
        if (planIsEditable(selectedPlan)) { window.location.assign(objectivePageUrl(selectedPlan.record_id, new URLSearchParams('create=1'))); return; }
        setNotice(selectedPlan
            ? 'This plan is approved or archived, so objectives can no longer be added to it.'
            : 'Choose a Strategic Plan in the filters, then select Add Strategic Objective.');
    }

    const select = (key, label, placeholder, options) => h('label', { key },
        h('span', null, label),
        h('select', { id: `objective-filter-${key}`, value: filters[key], disabled: loading && !objectives.length, onChange: event => applyFilter(key, event.target.value) },
            h('option', { value: '' }, placeholder),
            options.map(([value, text]) => h('option', { key: value, value }, text))));
    const filterBar = h('form', { className: 'objectives-filters', 'aria-label': 'Objective filters', onSubmit: event => { event.preventDefault(); load(filters); } },
        h('label', { className: 'objectives-filters__search' },
            h('span', null, 'Search'),
            h('input', { id: 'objective-filter-search', type: 'search', value: filters.search, placeholder: 'Objective, outcome, indicator or plan', onChange: event => setFilters({ ...filters, search: event.target.value }) })),
        select('plan_id', 'Strategic plan', 'All plans', plans.map(plan => [String(plan.record_id), plan.title || `Plan ${plan.record_id}`])),
        offices.length ? select('responsible_office_agency', 'Office / Unit', 'All offices / units', offices.map(name => [name, name])) : null,
        select('status', 'Status', 'All statuses', Object.entries(STATUS_LABELS)),
        h('button', { className: 'ui-button ui-button--secondary ui-button--sm objectives-filters__reset', type: 'button', onClick: resetFilters, disabled: !hasFilters },
            h('i', { className: 'bi bi-arrow-counterclockwise', 'aria-hidden': true }), ' Reset filters'));

    const planTitle = objective => objective.strategic_plan?.title || plans.find(plan => plan.record_id === objective.strategic_plan_id)?.title || '—';
    const currentPage = meta.current_page || 1, lastPage = meta.last_page || 1;
    const register = h('section', { className: 'ui-card objectives-card', 'aria-labelledby': 'objectives-title', 'aria-busy': loading },
        h('div', { className: 'objectives-heading' },
            h('div', null, h('h2', { id: 'objectives-title' }, 'Strategic Objectives'),
                h('p', { className: 'ui-help' }, loading ? 'Loading objectives…' : `${meta.total || 0} objective(s) · select one to open it`))),
        h('div', { className: 'ui-card__body' },
            error && h('p', { role: 'alert', className: 'ui-error' }, error, ' ',
                h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', onClick: () => load(filters, currentPage) }, 'Retry')),
            h('div', { className: 'ui-table-wrap' }, h('table', { className: 'ui-table objectives-table objectives-register' },
                h('thead', null, h('tr', null, ['Strategic Objective', 'Strategic Plan', 'Responsible Office/Agency', 'Status', 'Last Updated'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                h('tbody', null, !objectives.length
                    ? h('tr', null, h('td', { colSpan: 5, className: 'ui-empty' }, loading ? 'Loading objectives…' : hasFilters ? 'No objectives match these filters.' : 'No strategic objectives yet.'))
                    : objectives.map(objective => h('tr', { key: objective.objective_id, className: 'objectives-register__row', onClick: () => openObjective(objective) },
                        h('td', null, h('div', { className: 'objectives-register__cell' }, h('button', { type: 'button', className: 'objectives-register__open', onClick: event => { event.stopPropagation(); openObjective(objective); } },
                            objective.objective_title || 'Untitled objective'))),
                        h('td', null, h('div', { className: 'objectives-register__cell' }, planTitle(objective))),
                        h('td', null, h('div', { className: 'objectives-register__cell' }, officeName(objective) || 'Unassigned')),
                        h('td', null, h('span', { className: `ui-badge ui-badge--${objective.status}` }, STATUS_LABELS[objective.status] || objective.status)),
                        h('td', null, formatDate(objective.updated_at)))))))),
        h('div', { className: 'objectives-footer' }, h('span', null, `${meta.total || 0} objective(s)`),
            h('nav', { className: 'objectives-pagination', 'aria-label': 'Objectives pages' },
                h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', 'aria-label': 'Previous page', disabled: loading || currentPage <= 1, onClick: () => load(filters, currentPage - 1) }, h('i', { className: 'bi bi-chevron-left', 'aria-hidden': true })),
                h('span', { 'aria-live': 'polite' }, `${currentPage} / ${lastPage}`),
                h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', 'aria-label': 'Next page', disabled: loading || currentPage >= lastPage, onClick: () => load(filters, currentPage + 1) }, h('i', { className: 'bi bi-chevron-right', 'aria-hidden': true })))));

    return h(React.Fragment, null, h(AppSidebar),
        h('main', { className: 'app-shell-main objectives-page' }, h('div', { className: 'app-shell-container' },
            h(PageHeader, {
                section: 'Strategic Planning', title: 'Strategic Objectives', subtitle: 'Find strategic objectives across the plans you can access and open one to view its details.',
                actions: canCreate ? h('button', { className: 'ui-button ui-button--primary', type: 'button', onClick: addObjective }, h('i', { className: 'bi bi-plus-lg', 'aria-hidden': true }), 'Add Strategic Objective') : null,
            }),
            notice && h('div', { className: 'ui-status ui-status--info', role: 'status' }, notice),
            filterBar,
            register)),
        h(ObjectiveViewDialog, { objective: viewing, plan: viewing && plans.find(plan => plan.record_id === viewing.strategic_plan_id), onClose: () => setViewing(null) }));
}

mountProtectedPage(document.getElementById('root'), () => h(StrategicObjectivesListApp));
