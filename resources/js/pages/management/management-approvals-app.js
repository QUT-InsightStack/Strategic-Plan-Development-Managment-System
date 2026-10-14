import { createPageRoot } from '../../navigation/page-root.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { apiRequest } from '../../api/api-client.js';
import { listAssignedPlanSubmissions } from '../../api/plan-approval-api.js';
import { createAccessSession, saveAccessSession } from '../../access/access-session.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { isManagementSession } from '../../access/management-access.js';
import { planMatchesFilters, scopeFilters } from './management-insights.js';
import { ManagementFilterBar, useManagementFilters } from './management-filters.js';
import { ApprovalsPanel, managementApprovalsRedirect, mergeAssignedPlans } from './management-approvals.js';

const h = React.createElement;

function AssignedReviewsPage({ session }) {
    const { filters, setFilter, resetFilters } = useManagementFilters(window.location.search);
    const [attempt, setAttempt] = React.useState(0);
    const [state, setState] = React.useState({ plans: [], assigned: [], loading: true, error: '' });

    React.useEffect(() => {
        let active = true;
        setState(previous => ({ ...previous, loading: true, error: '' }));
        listAssignedPlanSubmissions().then(reviews => {
            if (active) setState({ plans: mergeAssignedPlans([], reviews), assigned: reviews, loading: false, error: '' });
        }).catch(reason => {
            if (active) setState({ plans: [], assigned: [], loading: false, error: reason.message || 'Assigned reviews could not be loaded.' });
        });
        return () => { active = false; };
    }, [attempt]);

    const scope = scopeFilters(filters);
    const plans = state.plans.filter(plan => planMatchesFilters(plan, scope) && (!scope.office || plan.department_agency === scope.office));
    const offices = [...new Set(state.plans.map(plan => plan.department_agency).filter(Boolean))].sort();

    return h('div', { className: 'app-shell management-dashboard' },
        h(AppSidebar),
        h('main', { className: 'app-shell-main' }, h('div', { className: 'management-dashboard__content' },
            h('header', { className: 'management-dashboard__header' }, h('div', null,
                h('p', { className: 'management-dashboard__eyebrow' }, 'Assigned reviewer'),
                h('h1', null, 'Assigned Plan Reviews'),
                h('p', null, `Review plans within your access. Decisions are available only when the current stage is assigned to ${session.name || 'you'}.`))),
            state.error ? h('div', { className: 'management-dashboard__errors', role: 'alert' }, h('p', null, state.error),
                h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setAttempt(value => value + 1) }, 'Retry')) : null,
            h(ManagementFilterBar, { filters, plans: state.plans, offices, onChange: setFilter, onReset: resetFilters, includeObjectiveStatus: false, disabled: state.loading }),
            state.error ? null : h(ApprovalsPanel, { session, management: false, plans, assigned: state.assigned, loading: state.loading, section: 'pending',
                emptyMessage: state.plans.length ? 'No plans match the current filters.' : 'No pending actions.' }))));
}

const root = createPageRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading approvals…'));
apiRequest('/api/auth/me').then(payload => {
    const session = saveAccessSession(createAccessSession(payload.data));
    if (isManagementSession(session)) { window.location.replace(managementApprovalsRedirect(window.location.href)); return; }
    if (!enforcePageAccess()) return;
    root.render(h(AssignedReviewsPage, { session }));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
