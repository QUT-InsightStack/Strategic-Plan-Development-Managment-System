import { OfficeWorkflow } from './office-workflow.js';
import { officeItems } from '../../access/office-navigation.js';
import { can } from '../../access/access-session.js';
import { OfficePlanInput } from './office-plan-input.js';
import { OfficePlanDetail } from './office-plan-detail.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { enforcePageAccess } from '../../access/access-guard.js';


import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { apiRequest } from '../../api/api-client.js';
import { createAccessSession, saveAccessSession } from '../../access/access-session.js';
const h = React.createElement;
const { useState, useEffect } = React;
const detailId = new URLSearchParams(location.search).get('plan');
const requestedView = new URLSearchParams(location.search).get('view') || 'comments';
const view = ['review', 'comments', 'inputs', 'edit', 'progress', 'mapping', 'alignment'].includes(requestedView) ? requestedView : 'review';
const entryHref = ['review', 'comments'].includes(view) ? '/office' : '/office?view=' + view;
const entry = officeItems.flatMap(item => item.children).find(item => item.href === entryHref);
const planLink = id => '/office?plan=' + encodeURIComponent(id) + (view === 'inputs' ? '&view=inputs' : view === 'comments' ? '#office-comments' : '');
const titles = { review: 'Plan List', comments: 'Plan Comments', edit: 'Edit Assigned Draft Objectives', inputs: 'Submit Input / Objective', proposal: 'Submit Proposal', progress: 'Update Assigned Progress', mapping: 'Agency Mapping', alignment: 'View Alignment' };
function OfficeApp() {
 const [plans, setPlans] = useState([]);
 const [meta, setMeta] = useState({});
 const [offices, setOffices] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [notice, setNotice] = useState('');
 const [inputPlanId, setInputPlanId] = useState('');
 const empty = { search: '', office: '', level: '', year: '' };
 const [filters, setFilters] = useState(empty);
 const [query, setQuery] = useState({ page: 1 });
 useEffect(() => {
  let active = true;
  setLoading(true); setError('');
  listStrategicPlans(query).then(payload => { if (active) { setPlans(payload.data || []); setOffices(payload.meta?.offices || []); setMeta(payload.meta || {}); } })
   .catch(err => { if (active) { setError(err.message); setPlans([]); setMeta({}); } }).finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
 }, [query]);
 useEffect(() => {
  if (view !== 'inputs' || inputPlanId || !plans.length) return;
  const firstDraft = plans.find(plan => plan.status === 'draft');
  if (firstDraft) setInputPlanId(String(firstDraft.record_id));
 }, [plans, inputPlanId]);
 const field = (name, label, options) => h('label', { className: 'office-filter', key: name }, label,
  options ? h('select', { value: filters[name], onChange: e => setFilters({ ...filters, [name]: e.target.value }) }, h('option', { value: '' }, `All ${label.toLowerCase()}`), options.map(option => h('option', { key: option.value ?? option, value: option.value ?? option }, option.label ?? option)))
   : h('input', { type: name === 'year' ? 'number' : 'search', placeholder: name === 'search' ? 'Search plans...' : 'YYYY', value: filters[name], onChange: e => setFilters({ ...filters, [name]: e.target.value }) }));

 if (view === 'inputs') {
  const draftPlans = plans.filter(plan => plan.status === 'draft');
  return h('div', { className: 'office-workspace' },
   h(AppSidebar, { active: 'Planning Module', onNotice: setNotice }),
   loading ? h('main', { className: 'office-content' }, h('p', { role: 'status' }, 'Loading available draft plans…'))
    : error ? h('main', { className: 'office-content' }, h('div', { className: 'office-panel', role: 'alert' }, error, ' ', h('button', { onClick: () => setQuery({ ...query }) }, 'Retry')))
    : !draftPlans.length ? h('main', { className: 'office-content' }, h('div', { className: 'office-panel' }, h('h1', null, 'Submit Planning Inputs'), h('p', null, 'No draft plans are currently available for input.')))
    : h(OfficePlanInput, { planId: inputPlanId || String(draftPlans[0].record_id), planOptions: draftPlans, onPlanChange: setInputPlanId }));
 }

 return h('div', { className: 'office-workspace' },
  h(AppSidebar, { active: ['mapping', 'alignment'].includes(view) ? 'Mapping Module' : 'Planning Module', onNotice: setNotice }),
  h('main', { className: 'office-content' },
   h('header', null, h('h1', null, titles[view] || titles.review),
    h('p', null, 'Select a plan within your assigned scope. Comments, inputs and content edits are available during drafting; progress updates apply to assigned objectives.')),
   notice && h('p', { role: 'status' }, notice),
   entry && !can(entry.permission) ? h('p', { role: 'alert' }, 'You do not have permission to access this function.') : ['edit', 'progress', 'mapping', 'alignment'].includes(view) ? h(OfficeWorkflow, { view }) : h(React.Fragment, null,
   h('form', { className: 'office-panel office-filters', onSubmit: e => { e.preventDefault(); setQuery({ ...filters, page: 1 }); } },
    h('h2', null, 'Search and filter'), h('div', { className: 'office-filter-grid' },
     field('search', 'Search'), field('office', 'Offices', offices), field('level', 'Type', [{ value: 'strategic_plan', label: 'Strategic plan' }, { value: 'goal', label: 'Goal' }]), field('year', 'Year', Array.from({ length: Math.max(1, new Date().getFullYear() - 1999) }, (_, index) => String(new Date().getFullYear() - index))),
     h('button', { type: 'submit', disabled: loading }, 'Filter'), h('button', { type: 'button', onClick: () => { setFilters(empty); setQuery({ page: 1 }); } }, 'Clear'))),
   h('section', { className: 'office-panel office-plans', 'aria-busy': loading }, h('h2', null, 'Strategic Plans'),
    error && h('p', { role: 'alert' }, error, ' ', h('button', { onClick: () => setQuery({ ...query }) }, 'Retry')),
    h('div', { className: 'office-table-scroll' }, h('table', null,
     h('thead', null, h('tr', null, ['Plan ID.', 'Plan title', 'Status', 'Created by', 'Department', 'Latest upload'].map(label => h('th', { key: label, scope: 'col' }, label)))),
     h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 6 }, 'Loading plans...')) : plans.length ? plans.map(plan => h('tr', { key: plan.record_id },
      h('td', null, h('a', { href: planLink(plan.record_id) }, plan.record_id)), h('td', null, h('a', { href: planLink(plan.record_id) }, plan.title)), h('td', null, h('span', { className: `office-badge ${plan.status === 'draft' ? 'is-draft' : ''}` }, plan.status)),
      h('td', null, plan.creator?.name || [plan.creator?.first_name, plan.creator?.last_name].filter(Boolean).join(' ') || '—'), h('td', null, plan.department_agency || plan.creator?.department || '—'), h('td', null, plan.updated_at ? new Date(plan.updated_at).toLocaleDateString('en-GB') : '—'))) : h('tr', null, h('td', { colSpan: 6 }, error ? 'Plans could not be loaded.' : 'No plans match your filters.'))))),
    h('footer', { className: 'office-pagination' }, h('span', null, `${meta.total || 0} plans`),
     h('button', { disabled: loading || query.page <= 1, onClick: () => setQuery({ ...query, page: query.page - 1 }), 'aria-label': 'Previous page' }, '‹'), h('span', null, `Page ${query.page} of ${meta.last_page || 1}`),
     h('button', { disabled: loading || query.page >= (meta.last_page || 1), onClick: () => setQuery({ ...query, page: query.page + 1 }), 'aria-label': 'Next page' }, '›'))))));
}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading your office access…'));
apiRequest('/api/auth/me').then(payload => {
 saveAccessSession(createAccessSession(payload.data));
 if (enforcePageAccess()) root.render(detailId ? h('div', { className: 'office-workspace' }, h(AppSidebar), new URLSearchParams(location.search).get('view') === 'inputs' ? h(OfficePlanInput, { planId: detailId }) : h(OfficePlanDetail, { planId: detailId })) : h(OfficeApp));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));


