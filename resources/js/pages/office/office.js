import { canonicalOfficeUrl, canOpenPage } from '../../access/navigation.js';
import { getAccessSession } from '../../access/access-session.js';
import { OfficeWorkflow } from './office-workflow.js';
import { officeItems } from '../../access/office-navigation.js';
import { can } from '../../access/access-session.js';
import { PERMISSIONS as P } from '../../access/access-policy.js';
import { OfficePlanInput } from './office-plan-input.js';
import { OfficePlanDetail } from './office-plan-detail.js';
import { officePlanHref, officeViewShowsAllPlans } from './office-plan-navigation.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { enforcePageAccess } from '../../access/access-guard.js';


import { listStrategicPlans, listUploadPlans } from '../../api/strategic-plans-api.js';
import { apiRequest } from '../../api/api-client.js';
import { createAccessSession, saveAccessSession } from '../../access/access-session.js';
const h = React.createElement;
const { useState, useEffect } = React;
const canonicalUrl = canonicalOfficeUrl(location.href);
if (canonicalUrl !== location.pathname + location.search + location.hash) history.replaceState({}, '', canonicalUrl);
const detailId = new URLSearchParams(location.search).get('plan');
const requestedView = new URLSearchParams(location.search).get('view') || 'review';
const view = ['review', 'comments', 'inputs', 'agency-input', 'edit', 'proposal', 'progress', 'mapping', 'alignment'].includes(requestedView) ? requestedView : 'review';
const entryHref = view === 'review' ? '/office' : '/office?view=' + view;
const entry = officeItems.flatMap(item => item.children).find(item => item.href === entryHref);
const planLink = id => officePlanHref(id, view);
const titles = { review: 'Plan Review', comments: 'Plan Comments', edit: 'Edit Assigned Draft Objectives', inputs: 'Submit Planning Inputs', 'agency-input': 'Submit Agency Input', proposal: 'Proposed Objectives', progress: 'Update and Monitor Progress', mapping: 'Agency Mapping', alignment: 'View Alignment' };
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
  (view === 'inputs' ? listUploadPlans() : listStrategicPlans({ ...query, ...(officeViewShowsAllPlans(view) ? { include_all_office_plans: 1 } : {}) })).then(payload => { if (active) { setPlans(payload.data || []); setOffices(payload.meta?.offices || []); setMeta(payload.meta || {}); } })
   .catch(err => { if (active) { setError(err.message); setPlans([]); setMeta({}); } }).finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
 }, [query]);
 useEffect(() => {
  if (!['inputs', 'agency-input'].includes(view) || inputPlanId || !plans.length) return;
  const firstAvailable = plans.find(plan => plan.status === 'draft');
  if (firstAvailable) setInputPlanId(String(firstAvailable.record_id));
 }, [plans, inputPlanId, view]);
 const field = (name, label, options) => h('label', { className: 'office-filter', key: name }, label,
  options ? h('select', { value: filters[name], onChange: e => setFilters({ ...filters, [name]: e.target.value }) }, h('option', { value: '' }, `All ${label.toLowerCase()}`), options.map(option => h('option', { key: option.value ?? option, value: option.value ?? option }, option.label ?? option)))
   : h('input', { type: name === 'year' ? 'number' : 'search', placeholder: name === 'search' ? 'Search plans...' : 'YYYY', value: filters[name], onChange: e => setFilters({ ...filters, [name]: e.target.value }) }));

 if (['inputs', 'agency-input'].includes(view)) {
  const draftPlans = plans.filter(plan => plan.status === 'draft');
  const selectedPlanId = inputPlanId || (draftPlans[0] ? String(draftPlans[0].record_id) : '');
  return h('div', { className: 'office-workspace' },
   h(AppSidebar, { active: 'Planning Module', onNotice: setNotice }),
   h(OfficePlanInput, {
      planId: selectedPlanId,
      plansLoading: loading, listError: error, onRetryPlans: () => setQuery({ ...query }),
      planOptions: draftPlans,
      onPlanChange: setInputPlanId,
      pageTitle: titles[view],
      description: view === 'agency-input' ? 'Upload agency reference materials for the selected strategic plan.' : 'Upload reference materials for the selected strategic plan.',
     }));
 }

 if (view === 'progress') {
  const correction = can(P.OBJECTIVES_CORRECT_PROGRESS);
  const progressAccess = can(P.OBJECTIVES_VIEW_PROGRESS) || can(P.OBJECTIVES_UPDATE_PROGRESS) || correction;
  const progressPage = h('div', { className: 'app-shell-container progress-monitoring-container' },
   h(PageHeader, { section: correction ? 'Strategic Planning' : 'Planning Module', title: titles.progress,
    subtitle: correction ? 'Monitor progress across strategic objectives and correct Office/Unit updates with an audit reason.' : 'View and update progress for strategic objectives assigned to your Office/Unit.' }),
   notice && h('p', { role: 'status' }, notice),
   progressAccess ? h(OfficeWorkflow, { view }) : h('div', { className: 'ui-status ui-status--error', role: 'alert' }, 'You do not have permission to view objective progress.'));
  return h(React.Fragment, null,
   h(AppSidebar, { active: 'Planning Module', onNotice: setNotice }),
   h('main', { className: 'app-shell-main progress-monitoring-page' }, progressPage));
 }

 return h('div', { className: 'office-workspace' },
  h(AppSidebar, { active: ['mapping', 'alignment'].includes(view) ? 'Mapping Module' : 'Planning Module', onNotice: setNotice }),
  h('main', { className: 'office-content' },
   h('header', null, h('h1', null, titles[view] || titles.review),
    h('p', null, view === 'comments'
     ? 'Select a plan to review its contents and submit a plan comment.'
     : view === 'proposal' ? 'Select a plan to review its contents and propose a strategic objective.'
     : 'Select an Initial Strategic Plan to view its summary and objectives.')),
   notice && h('p', { role: 'status' }, notice),
   entry && !(view === 'progress'
    ? can(P.OBJECTIVES_VIEW_PROGRESS) || can(P.OBJECTIVES_UPDATE_PROGRESS) || can(P.OBJECTIVES_CORRECT_PROGRESS)
    : canOpenPage(entry, getAccessSession())) ? h('p', { role: 'alert' }, 'You do not have permission to access this function.') : ['edit', 'progress', 'mapping', 'alignment'].includes(view) ? h(OfficeWorkflow, { view }) : h(React.Fragment, null,
   h('form', { className: 'office-panel office-filters', onSubmit: e => { e.preventDefault(); setQuery({ ...filters, page: 1 }); } },
    h('h2', null, 'Search and filter'), h('div', { className: 'office-filter-grid' },
     field('search', 'Search'), field('office', 'Offices', offices), field('level', 'Type', [{ value: 'strategic_plan', label: 'Strategic plan' }, { value: 'goal', label: 'Goal' }]), field('year', 'Year', Array.from({ length: Math.max(1, new Date().getFullYear() - 1999) }, (_, index) => String(new Date().getFullYear() - index))),
     h('button', { type: 'submit', disabled: loading }, 'Filter'), h('button', { type: 'button', onClick: () => { setFilters(empty); setQuery({ page: 1 }); } }, 'Clear'))),
   h('section', { className: 'office-panel office-plans', 'aria-busy': loading }, h('h2', null, 'Strategic Plans'),
    error && h('p', { role: 'alert' }, error, ' ', h('button', { onClick: () => setQuery({ ...query }) }, 'Retry')),
    h('div', { className: 'office-table-scroll' }, h('table', null,
     h('thead', null, h('tr', null, ['Plan ID.', 'Initial Strategic Plan', 'Status', 'Created by', 'Department', 'Latest upload', 'Action'].map(label => h('th', { key: label, scope: 'col' }, label)))),
     h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 7 }, 'Loading plans...')) : plans.length ? plans.map(plan => h('tr', { key: plan.record_id },
      h('td', null, h('a', { href: planLink(plan.record_id) }, plan.record_id)), h('td', null, h('a', { href: planLink(plan.record_id) }, plan.title)), h('td', null, h('span', { className: `office-badge ${plan.status === 'draft' ? 'is-draft' : ''}` }, plan.status)),
      h('td', null, plan.creator?.name || [plan.creator?.first_name, plan.creator?.last_name].filter(Boolean).join(' ') || '—'), h('td', null, plan.department_agency || plan.creator?.department || '—'), h('td', null, plan.updated_at ? new Date(plan.updated_at).toLocaleDateString('en-GB') : '—'),
      h('td', null, h('a', { className: 'office-action-link', href: planLink(plan.record_id) }, view === 'review' ? 'View Plan' : 'Open Plan')))) : h('tr', null, h('td', { colSpan: 7 }, error ? 'Plans could not be loaded.' : 'No plans match your filters.'))))),
    h('footer', { className: 'office-pagination' }, h('span', null, `${meta.total || 0} plan${meta.total === 1 ? '' : 's'}`),
     h('button', { disabled: loading || query.page <= 1, onClick: () => setQuery({ ...query, page: query.page - 1 }), 'aria-label': 'Previous page' }, '‹'), h('span', null, `Page ${query.page} of ${meta.last_page || 1}`),
     h('button', { disabled: loading || query.page >= (meta.last_page || 1), onClick: () => setQuery({ ...query, page: query.page + 1 }), 'aria-label': 'Next page' }, '›'))))));
}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading your office access…'));
apiRequest('/api/auth/me').then(payload => {
 saveAccessSession(createAccessSession(payload.data));
 if (enforcePageAccess()) root.render(detailId ? h('div', { className: 'office-workspace' }, h(AppSidebar), view === 'inputs' ? h(OfficePlanInput, { planId: detailId }) : h(OfficePlanDetail, { planId: detailId, mode: view, includeAllOfficePlans: officeViewShowsAllPlans(view) })) : h(OfficeApp));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
