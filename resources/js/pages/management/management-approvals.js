import { isSubmissionAssignedToReviewer } from '../../api/plan-approval-api.js';
import { ManagementPagination, pageRows } from '../../components/ManagementPagination.js';
import { managementDateLabel } from './management-data.js';

const h = (...args) => React.createElement(...args);

export const APPROVAL_SECTIONS = [
    { id: 'pending', label: 'Awaiting approval', icon: 'bi-hourglass-split' },
    { id: 'approved', label: 'Approved', icon: 'bi-check-circle' },
    { id: 'returned', label: 'Returned for correction', icon: 'bi-arrow-return-left' },
];

export function approvalSection(value) {
    return APPROVAL_SECTIONS.some(item => item.id === value) ? value : 'pending';
}

// Management reviews approvals in the dashboard's Reviews & Approvals tab; /management-approvals keeps
// serving assigned reviewers in other roles and redirects Management (old links included) to the tab.
export function managementApprovalsRedirect(href) {
    const url = new URL(href);
    const target = new URL('/management-dashboard', url.origin);
    url.searchParams.forEach((value, key) => { if (key !== 'status') target.searchParams.set(key, value); });
    target.searchParams.set('tab', 'approvals');
    target.searchParams.set('queue', approvalSection(url.searchParams.get('status')));
    return target.pathname + target.search;
}

// Assigned reviews can reference plans outside the plan listing; show them as awaiting approval.
export function mergeAssignedPlans(plans, reviews) {
    const byId = new Map(plans.map(plan => [String(plan.record_id), plan]));
    reviews.forEach(review => {
        if (!byId.has(String(review.planId))) {
            byId.set(String(review.planId), { ...(review.plan_snapshot || {}), record_id: review.planId, approval_status: 'under_approval' });
        }
    });
    return [...byId.values()];
}

export function approvalGroups(plans) {
    return {
        pending: plans.filter(plan => plan.approval_status === 'under_approval'),
        approved: plans.filter(plan => plan.approval_status === 'approved'),
        returned: plans.filter(plan => plan.approval_status === 'rejected'),
    };
}

// Approve / return stays on the existing decision page and is linked only for the current stage's assigned reviewer.
export function ApprovalsPanel({ session, management, plans, assigned, loading, section, onSectionChange, emptyMessage }) {
    const [search, setSearch] = React.useState('');
    const [stage, setStage] = React.useState('');
    const [page, setPage] = React.useState(1);
    React.useEffect(() => { setPage(1); }, [section, plans.length]);
    const assignedById = new Map(assigned.map(item => [String(item.planId), item]));
    const groups = approvalGroups(plans);
    const activeSection = management ? section : 'pending';
    const sectionInfo = APPROVAL_SECTIONS.find(item => item.id === activeSection);
    const visible = (management ? groups[activeSection] : groups.pending.filter(plan => assignedById.has(String(plan.record_id)))).filter(plan =>
        `${plan.record_id} ${plan.title || ''} ${plan.department_agency || ''}`.toLowerCase().includes(search.trim().toLowerCase())
        && (!stage || assignedById.get(String(plan.record_id))?.currentStage?.name === stage));
    const stages = [...new Set(assigned.map(item => item.currentStage?.name).filter(Boolean))].sort();

    return h(React.Fragment, null,
        management ? h('nav', { className: 'management-dashboard__tabs management-dashboard__tabs--sub', 'aria-label': 'Approval status' }, APPROVAL_SECTIONS.map(item => h('button', {
            key: item.id, type: 'button', className: `management-dashboard__tab${activeSection === item.id ? ' is-active' : ''}`,
            'aria-pressed': activeSection === item.id, onClick: () => onSectionChange(item.id),
        }, h('i', { className: `bi ${item.icon}`, 'aria-hidden': true }), ` ${item.label} (${loading ? '…' : groups[item.id].length})`))) : null,
        h('section', { className: 'management-card management-table-card' },
            h('div', { className: 'management-card__heading' }, h('div', null,
                h('h2', null, sectionInfo.label),
                h('p', null, activeSection === 'returned'
                    ? 'Returned plans are stored as rejected submissions; the submitting team can correct and resubmit them.'
                    : 'Open a plan to read it. Decisions are available only when the current stage is assigned to you.')),
                h('div', { className: 'management-card__actions' },
                    stages.length ? h('label', { className: 'management-approvals__search' }, h('span', null, 'Review stage'), h('select', { value: stage, onChange: event => { setStage(event.target.value); setPage(1); } },
                        h('option', { value: '' }, 'All stages'), stages.map(item => h('option', { key: item, value: item }, item)))) : null,
                    h('label', { className: 'management-approvals__search' }, h('span', null, 'Search plans'), h('input', {
                        type: 'search', value: search, onChange: event => { setSearch(event.target.value); setPage(1); }, placeholder: 'Plan title, ID or agency',
                    })))),
            h('div', { className: 'management-table-scroll' }, h('table', null,
                h('thead', null, h('tr', null, ['Strategic plan', 'Agency / Office', 'Current stage', 'Submitted / Updated', 'Status', 'Action'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                h('tbody', null, loading ? skeletonRows(6) : visible.length ? pageRows(visible, page).map(plan => {
                    const assignedReview = assignedById.get(String(plan.record_id));
                    const review = isSubmissionAssignedToReviewer(assignedReview, session) ? assignedReview : null;
                    const canDecide = review && activeSection === 'pending';
                    return h('tr', { key: plan.record_id },
                        h('th', { scope: 'row' }, plan.title || `Plan ${plan.record_id}`),
                        h('td', null, plan.department_agency || '—'),
                        h('td', null, review?.currentStage?.name || assignedReview?.currentStage?.name || '—'),
                        h('td', null, managementDateLabel(review?.submittedAt || plan.updated_at)),
                        h('td', null, h('span', { className: `management-status is-${activeSection}` }, sectionInfo.label)),
                        h('td', null, h('a', { className: `ui-button ui-button--${canDecide ? 'primary' : 'secondary'} ui-button--sm`, href: canDecide ? `/strategic-plan-reviews/${plan.record_id}` : `/management-plan-review?plan=${plan.record_id}` }, canDecide ? 'Review / decide' : 'View plan')));
                }) : h('tr', null, h('td', { colSpan: 6 }, search || stage ? 'No plans match this search.' : emptyMessage || 'No plans in this category.'))))),
            h(ManagementPagination, { page, total: visible.length, onChange: setPage, label: 'plans' })));
}

export function skeletonRows(columns, rows = 4) {
    return Array.from({ length: rows }, (_, row) => h('tr', { key: `skeleton-${row}`, className: 'management-skeleton-row', 'aria-hidden': true },
        Array.from({ length: columns }, (_, column) => h('td', { key: column }, h('span', { className: 'management-skeleton' })))));
}
