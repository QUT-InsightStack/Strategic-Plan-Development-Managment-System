import { AppSidebar } from '../../components/AppSidebar.js';
import { apiRequest } from '../../api/api-client.js';
import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { listAssignedPlanSubmissions } from '../../api/plan-approval-api.js';
import { createAccessSession, saveAccessSession } from '../../access/access-session.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { isManagementSession } from '../../access/management-access.js';
import { ManagementPagination, pageRows } from '../../components/ManagementPagination.js';

const h = React.createElement;
const sections = [
    { id: 'approved', label: 'Approved', icon: 'bi-check-circle' },
    { id: 'pending', label: 'Pending approval', icon: 'bi-hourglass-split' },
    { id: 'returned', label: 'Returned for correction', icon: 'bi-arrow-return-left' },
];

async function authorizedPlans() {
    const plans = [];
    let page = 1;
    let lastPage = 1;
    do {
        const response = await listStrategicPlans({ page, per_page: 100 });
        plans.push(...(response.data || []));
        lastPage = Number(response.meta?.last_page || response.last_page || 1);
        page += 1;
    } while (page <= lastPage);
    return plans;
}

function dateLabel(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ApprovalsPage({ session }) {
    const requested = new URLSearchParams(window.location.search).get('status');
    const [section, setSection] = React.useState(sections.some(item => item.id === requested) ? requested : 'pending');
    const [search, setSearch] = React.useState('');
    const [page, setPage] = React.useState(1);
    const [state, setState] = React.useState({ plans: [], assigned: [], loading: true, error: '' });

    React.useEffect(() => {
        let active = true;
        Promise.allSettled([authorizedPlans(), listAssignedPlanSubmissions()]).then(([plans, reviews]) => {
            if (!active) return;
            setState({
                plans: plans.status === 'fulfilled' ? plans.value : [],
                assigned: reviews.status === 'fulfilled' ? reviews.value : [],
                loading: false,
                error: plans.status === 'rejected' ? plans.reason.message || 'Plans could not be loaded.' : reviews.status === 'rejected' && reviews.reason?.status !== 403 ? reviews.reason.message || 'Assigned reviews could not be loaded.' : '',
            });
        });
        return () => { active = false; };
    }, []);

    const assigned = new Map(state.assigned.map(item => [String(item.planId), item]));
    const groups = {
        pending: state.plans.filter(plan => plan.approval_status === 'under_approval'),
        approved: state.plans.filter(plan => plan.approval_status === 'approved'),
        returned: state.plans.filter(plan => plan.approval_status === 'rejected'),
    };
    const visible = groups[section].filter(plan => `${plan.record_id} ${plan.title || ''} ${plan.department_agency || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
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
                h('p', { className: 'management-dashboard__eyebrow' }, 'Management / Executive'),
                h('h1', null, 'Approve List'),
                h('p', null, `Review plans within your access. Decisions are available only when the current stage is assigned to ${session.name || 'you'}.`))),
            state.error ? h('p', { className: 'management-dashboard__errors', role: 'alert' }, state.error) : null,
            h('nav', { className: 'management-dashboard__tabs', 'aria-label': 'Approval status' }, sections.map(item => h('button', {
                key: item.id, type: 'button', className: `management-dashboard__tab${section === item.id ? ' is-active' : ''}`,
                'aria-current': section === item.id ? 'page' : undefined, onClick: () => selectSection(item.id),
            }, h('i', { className: `bi ${item.icon}`, 'aria-hidden': true }), ` ${item.label} (${groups[item.id].length})`))),
            h('section', { className: 'management-card management-table-card management-approvals__panel' },
                h('div', { className: 'management-card__heading' }, h('div', null,
                    h('h2', null, sections.find(item => item.id === section).label),
                    h('p', null, section === 'returned' ? 'The current backend records returned-for-correction decisions as rejected submissions; the submitting team can correct and resubmit.' : 'Open a plan to review its details and current workflow status.')),
                h('label', { className: 'management-approvals__search' }, h('span', null, 'Search plans'), h('input', {
                    type: 'search', value: search, onChange: event => { setSearch(event.target.value); setPage(1); }, placeholder: 'Plan title, ID or agency',
                }))),
                h('div', { className: 'management-table-scroll' }, h('table', null,
                    h('thead', null, h('tr', null, ['Strategic plan', 'Agency / Office', 'Current stage', 'Submitted / Updated', 'Status', 'Action'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                    h('tbody', null, state.loading ? h('tr', null, h('td', { colSpan: 6 }, 'Loading plans…')) : pagedVisible.length ? pagedVisible.map(plan => {
                        const review = assigned.get(String(plan.record_id));
                        return h('tr', { key: plan.record_id },
                            h('th', { scope: 'row' }, plan.title || `Plan ${plan.record_id}`),
                            h('td', null, plan.department_agency || '—'),
                            h('td', null, review?.currentStage?.name || '—'),
                            h('td', null, dateLabel(review?.submittedAt || plan.updated_at)),
                            h('td', null, h('span', { className: `management-status is-${section}` }, sections.find(item => item.id === section).label)),
                            h('td', null, h('a', { className: 'ui-button ui-button--primary ui-button--sm', href: review && section === 'pending' ? `/strategic-plan-reviews/${plan.record_id}` : `/management-plan-review?plan=${plan.record_id}` }, review && section === 'pending' ? 'Review / decide' : 'View plan')));
                    }) : h('tr', null, h('td', { colSpan: 6 }, 'No plans in this category.'))))),
                h(ManagementPagination, { page, total: visible.length, onChange: setPage, label: 'plans' })))));
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading approvals…'));
apiRequest('/api/auth/me').then(payload => {
    const session = saveAccessSession(createAccessSession(payload.data));
    if (!enforcePageAccess()) return;
    if (!isManagementSession(session)) { window.location.replace('/access-denied'); return; }
    root.render(h(ApprovalsPage, { session }));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
