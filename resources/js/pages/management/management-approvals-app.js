import { createPageRoot } from '../../navigation/page-root.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { apiRequest } from '../../api/api-client.js';
import { listAssignedPlanSubmissions, isSubmissionAssignedToReviewer } from '../../api/plan-approval-api.js';
import { createAccessSession, saveAccessSession } from '../../access/access-session.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { isManagementSession } from '../../access/management-access.js';
import { ManagementPagination, pageRows } from '../../components/ManagementPagination.js';
import { planningYears } from './management-insights.js';
import { listAuthorizedManagementPlans, managementDateLabel } from './management-data.js';

const h = React.createElement;
const sections = [
    { id: 'approved', label: 'Approved', icon: 'bi-check-circle' },
    { id: 'pending', label: 'Pending approval', icon: 'bi-hourglass-split' },
    { id: 'returned', label: 'Returned for correction', icon: 'bi-arrow-return-left' },
];

function ApprovalsPage({ session }) {
    const management = isManagementSession(session);
    const requested = new URLSearchParams(window.location.search).get('status');
    const [section, setSection] = React.useState(sections.some(item => item.id === requested) ? requested : 'pending');
    const [search, setSearch] = React.useState('');
    const [office, setOffice] = React.useState('');
    const [stage, setStage] = React.useState('');
    const [year, setYear] = React.useState('');
    const [planStatus, setPlanStatus] = React.useState('');
    const [page, setPage] = React.useState(1);
    const [state, setState] = React.useState({ plans: [], assigned: [], loading: true, error: '' });

    React.useEffect(() => {
        let active = true;
        Promise.allSettled([management ? listAuthorizedManagementPlans() : Promise.resolve([]), listAssignedPlanSubmissions()]).then(([plans, reviews]) => {
            if (!active) return;
            const assignedReviews = reviews.status === 'fulfilled' ? reviews.value : [];
            const accessiblePlans = plans.status === 'fulfilled' ? plans.value : [];
            const byId = new Map(accessiblePlans.map(plan => [String(plan.record_id), plan]));
            assignedReviews.forEach(review => {
                if (!byId.has(String(review.planId))) {
                    byId.set(String(review.planId), { ...(review.plan_snapshot || {}), record_id: review.planId, approval_status: 'under_approval' });
                }
            });
            setState({
                plans: [...byId.values()],
                assigned: assignedReviews,
                loading: false,
                error: plans.status === 'rejected' ? plans.reason.message || 'Plans could not be loaded.' : reviews.status === 'rejected' ? reviews.reason.message || 'Assigned reviews could not be loaded.' : '',
            });
        });
        return () => { active = false; };
    }, [management]);

    const assigned = new Map(state.assigned.map(item => [String(item.planId), item]));
    const groups = {
        pending: state.plans.filter(plan => plan.approval_status === 'under_approval'),
        approved: state.plans.filter(plan => plan.approval_status === 'approved'),
        returned: state.plans.filter(plan => plan.approval_status === 'rejected'),
    };
    const visible = (management ? groups[section] : groups.pending.filter(plan => assigned.has(String(plan.record_id)))).filter(plan =>
        `${plan.record_id} ${plan.title || ''} ${plan.department_agency || ''}`.toLowerCase().includes(search.trim().toLowerCase())
        && (!stage || assigned.get(String(plan.record_id))?.currentStage?.name === stage)
        && (!office || plan.department_agency === office)
        && (!planStatus || plan.status === planStatus)
        && (!year || (Number(String(plan.planning_start_date || '').slice(0, 4)) <= Number(year)
            && Number(String(plan.planning_end_date || '').slice(0, 4)) >= Number(year))));
    const pagedVisible = pageRows(visible, page);

    function selectSection(id) {
        setSection(id);
        setPage(1);
        const url = new URL(window.location.href);
        url.searchParams.set('status', id);
        window.history.replaceState({}, '', url);
    }

    return h('div', { className: 'app-shell management-dashboard' },
        h(AppSidebar),
        h('main', { className: 'app-shell-main' }, h('div', { className: 'management-dashboard__content' },
            h('header', { className: 'management-dashboard__header' }, h('div', null,
                h('p', { className: 'management-dashboard__eyebrow' }, management ? 'Management / Executive' : 'Assigned reviewer'),
                h('h1', null, management ? 'Approve List' : 'Assigned Plan Reviews'),
                h('p', null, `Review plans within your access. Decisions are available only when the current stage is assigned to ${session.name || 'you'}.`))),
            state.error ? h('p', { className: 'management-dashboard__errors', role: 'alert' }, state.error) : null,
            management ? h('nav', { className: 'management-dashboard__tabs', 'aria-label': 'Approval status' }, sections.map(item => h('button', {
                key: item.id, type: 'button', className: `management-dashboard__tab${section === item.id ? ' is-active' : ''}`,
                'aria-current': section === item.id ? 'page' : undefined, onClick: () => selectSection(item.id),
            }, h('i', { className: `bi ${item.icon}`, 'aria-hidden': true }), ` ${item.label} (${groups[item.id].length})`))) : null,
            h('section', { className: 'management-card management-table-card management-approvals__panel' },
                h('div', { className: 'management-card__heading' }, h('div', null,
                    h('h2', null, management ? sections.find(item => item.id === section).label : 'Pending approval'),
                    h('p', null, section === 'returned' ? 'The current backend records returned-for-correction decisions as rejected submissions; the submitting team can correct and resubmit.' : 'Open a plan to review its details and current workflow status.')),
                h('label', { className: 'management-approvals__search' }, h('span', null, 'Search plans'), h('input', {
                    type: 'search', value: search, onChange: event => { setSearch(event.target.value); setPage(1); }, placeholder: 'Plan title, ID or agency',
                }))),
                h('div', { className: 'management-scope-filters', 'aria-label': 'Approval list filters' },
                    h('label', null, h('span', null, 'Review stage'), h('select', { value: stage, onChange: event => { setStage(event.target.value); setPage(1); } }, h('option', { value: '' }, 'All stages'), [...new Set(state.assigned.map(item => item.currentStage?.name).filter(Boolean))].sort().map(item => h('option', { key: item, value: item }, item)))),
                    h('label', null, h('span', null, 'Planning period'), h('select', { value: year, onChange: event => { setYear(event.target.value); setPage(1); } }, h('option', { value: '' }, 'All periods'), planningYears(state.plans).map(item => h('option', { key: item, value: String(item) }, item)))),
                    h('label', null, h('span', null, 'Office / Unit'), h('select', { value: office, onChange: event => { setOffice(event.target.value); setPage(1); } }, h('option', { value: '' }, 'All offices'), [...new Set(state.plans.map(plan => plan.department_agency).filter(Boolean))].sort().map(item => h('option', { key: item, value: item }, item)))),
                    h('label', null, h('span', null, 'Plan status'), h('select', { value: planStatus, onChange: event => { setPlanStatus(event.target.value); setPage(1); } }, h('option', { value: '' }, 'All statuses'), [...new Set(state.plans.map(plan => plan.status).filter(Boolean))].sort().map(item => h('option', { key: item, value: item }, item.replaceAll('_', ' ')))))),
                h('div', { className: 'management-table-scroll' }, h('table', null,
                    h('thead', null, h('tr', null, ['Strategic plan', 'Agency / Office', 'Current stage', 'Submitted / Updated', 'Status', 'Action'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                    h('tbody', null, state.loading ? h('tr', null, h('td', { colSpan: 6 }, 'Loading plans…')) : pagedVisible.length ? pagedVisible.map(plan => {
                        const assignedReview = assigned.get(String(plan.record_id));
                        const review = isSubmissionAssignedToReviewer(assignedReview, session) ? assignedReview : null;
                        return h('tr', { key: plan.record_id },
                            h('th', { scope: 'row' }, plan.title || `Plan ${plan.record_id}`),
                            h('td', null, plan.department_agency || '—'),
                            h('td', null, review?.currentStage?.name || '—'),
                            h('td', null, managementDateLabel(review?.submittedAt || plan.updated_at)),
                            h('td', null, h('span', { className: `management-status is-${management ? section : 'pending'}` }, management ? sections.find(item => item.id === section).label : 'Pending approval')),
                            h('td', null, h('a', { className: 'ui-button ui-button--primary ui-button--sm', href: review && (section === 'pending' || !management) ? `/strategic-plan-reviews/${plan.record_id}` : `/management-plan-review?plan=${plan.record_id}` }, review && (section === 'pending' || !management) ? 'Review / decide' : 'View plan')));
                    }) : h('tr', null, h('td', { colSpan: 6 }, state.plans.length ? 'No plans match these filters.' : 'No plans in this category.'))))),
                h(ManagementPagination, { page, total: visible.length, onChange: setPage, label: 'plans' })))));
}

const root = createPageRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading approvals…'));
apiRequest('/api/auth/me').then(payload => {
    const session = saveAccessSession(createAccessSession(payload.data));
    if (!enforcePageAccess()) return;
    root.render(h(ApprovalsPage, { session }));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
