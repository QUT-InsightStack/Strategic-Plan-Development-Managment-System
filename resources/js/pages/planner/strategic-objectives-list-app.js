import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { getStrategicObjective } from '../../api/strategic-objectives-api.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { mountProtectedPage } from '../../access/mount-protected-page.js';

const h = React.createElement;
const { useEffect, useState } = React;

function objectivePageUrl(planId, params = new URLSearchParams()) {
    const query = new URLSearchParams();
    if (/^[1-9][0-9]*$/.test(params.get('edit') || '')) query.set('edit', params.get('edit'));
    if (params.get('create') === '1') query.set('create', '1');
    return `/strategic-plans/${planId}/objectives${query.size ? `?${query}` : ''}`;
}

// This entry only selects a plan. All objective editing lives in strategic-objectives-app.js.
function StrategicObjectivesListApp() {
    const [plans, setPlans] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        async function load() {
            try {
                const query = new URLSearchParams(window.location.search);
                const planId = query.get('plan_id');
                if (/^[1-9][0-9]*$/.test(planId || '')) {
                    window.location.replace(objectivePageUrl(planId, query));
                    return;
                }
                // Preserve old deep links to a particular objective without duplicating its editor.
                if (/^[1-9][0-9]*$/.test(query.get('edit') || '')) {
                    const result = await getStrategicObjective(query.get('edit'));
                    if (active) window.location.replace(objectivePageUrl(result.data.strategic_plan_id, query));
                    return;
                }
                const all = [];
                let page = 1, last = 1;
                do {
                    const result = await listStrategicPlans({ per_page: 100, page });
                    all.push(...(result.data || []));
                    last = result.meta?.last_page || 1;
                    page++;
                } while (active && page <= last);
                if (active) setPlans(all);
            } catch (err) { if (active) setError(err.message); }
            finally { if (active) setLoading(false); }
        }
        load();
        return () => { active = false; };
    }, [attempt]);
    const matches = plans.filter(plan => `${plan.record_id} ${plan.title}`.toLowerCase().includes(search.trim().toLowerCase()));
    const selected = plans.find(plan => String(plan.record_id) === selectedId);
    return h(React.Fragment, null, h(AppSidebar),
        h('main', { className: 'app-shell-main objectives-page' }, h('div', { className: 'app-shell-container' },
            h(PageHeader, { section: 'Strategic Planning', title: 'Strategic Objectives', subtitle: 'Choose a plan to review its summary and manage its strategic objectives.' }),
            h('section', { className: 'ui-card objective-plan-picker', 'aria-busy': loading },
                h('div', { className: 'ui-card__header' }, h('h2', { className: 'ui-card__title' }, 'Select a Strategic Plan')),
                h('form', { className: 'ui-card__body', onSubmit: event => { event.preventDefault(); if (selected) window.location.assign(objectivePageUrl(selectedId)); } },
                    h('div', { className: 'objective-plan-picker__fields' },
                        h('div', { className: 'ui-field' }, h('label', { className: 'ui-label', htmlFor: 'plan-search' }, 'Search plan title or ID'),
                            h('input', { className: 'ui-input', id: 'plan-search', type: 'search', value: search, placeholder: 'Search strategic plans', onChange: event => setSearch(event.target.value) })),
                        h('div', { className: 'ui-field' }, h('label', { className: 'ui-label', htmlFor: 'selected-plan' }, 'Strategic Plan'),
                            h('select', { className: 'ui-select', id: 'selected-plan', value: selectedId, disabled: loading || Boolean(error), onChange: event => setSelectedId(event.target.value) },
                                h('option', { value: '' }, loading ? 'Loading plans…' : 'Select a plan'),
                                selected && !matches.includes(selected) && h('option', { value: selectedId }, `${selectedId} · ${selected.title} (selected)`),
                                matches.map(plan => h('option', { key: plan.record_id, value: plan.record_id }, `${plan.record_id} · ${plan.title} · ${plan.status}`))))),
                    error && h('p', { role: 'alert', className: 'ui-error' }, error, ' ', h('button', { type: 'button', className: 'ui-button ui-button--secondary', onClick: () => setAttempt(value => value + 1) }, 'Retry')),
                    !loading && !error && !matches.length && h('p', { role: 'status' }, 'No plans match your search.'),
                    h('button', { type: 'submit', className: 'ui-button ui-button--primary', disabled: loading || Boolean(error) || !selected }, 'Open Objectives'))))));
}

mountProtectedPage(document.getElementById('root'), () => h(StrategicObjectivesListApp));
