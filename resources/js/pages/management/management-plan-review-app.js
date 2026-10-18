import { createPageRoot } from '../../navigation/page-root.js';
import { usePageQuery } from '../../navigation/use-page-query.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { apiRequest } from '../../api/api-client.js';
import { listAuthorizedManagementPlans } from './management-data.js';
import { ManagementPlanReview } from './management-plan-review.js';
import { ManagementFilterBar, useManagementFilters } from './management-filters.js';
import { scopeFilters } from './management-insights.js';
import { createAccessSession, saveAccessSession, can } from '../../access/access-session.js';
import { PERMISSIONS } from '../../access/access-policy.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { isManagementSession } from '../../access/management-access.js';
import { PageHeader } from '../../components/PageHeader.js';

const h = React.createElement;

function PlanReviewPage({ session }) {
    const pageQuery = usePageQuery();
    const query = new URLSearchParams(pageQuery);
    const [plans, setPlans] = React.useState([]);
    const [selectedPlanId, setSelectedPlanId] = React.useState(query.get('plan') || '');
    const { filters, setFilter, resetFilters } = useManagementFilters(pageQuery);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [attempt, setAttempt] = React.useState(0);
    React.useEffect(() => {
        setSelectedPlanId(new URLSearchParams(pageQuery).get('plan') || '');
    }, [pageQuery]);
    function choosePlan(id) {
        setSelectedPlanId(String(id));
        const url = new URL(window.location.href);
        if (id) url.searchParams.set('plan', String(id));
        else url.searchParams.delete('plan');
        window.history.replaceState({}, '', url);
    }

    React.useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        listAuthorizedManagementPlans().then(rows => {
    if (active) {
        setPlans(rows.filter(plan =>
            ['draft', 'finished'].includes(plan.status)
        ));
    }
})
            .catch(reason => { if (active) setError(reason.message || 'Unable to load authorized plans.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [attempt]);

    const selectedPlan = plans.find(plan => String(plan.record_id) === String(selectedPlanId));
    return h('div', { className: 'app-shell management-dashboard' },
        h(AppSidebar, { active: 'Planning Module' }),
        h('main', { className: 'app-shell-main' }, h('div', { className: 'management-dashboard__content' },
            h(PageHeader, { section: 'Plan Review', title: 'Plan Review', trail: selectedPlan ? [selectedPlan.title || `Plan ${selectedPlan.record_id}`] : [],
                subtitle: 'Review finalized strategic plans, foundations, objectives and comments. Drafts are not included.' }),
            error ? h('div', { className: 'management-dashboard__errors', role: 'alert' }, error, ' ', h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setAttempt(value => value + 1) }, 'Retry')) : null,
            !error && !selectedPlanId && can(PERMISSIONS.PLANS_VIEW, session) ? h(ManagementFilterBar, { filters, plans, offices: [...new Set(plans.map(plan => plan.department_agency).filter(Boolean))].sort(),
                onChange: setFilter, onReset: resetFilters, includeObjectiveStatus: false, disabled: loading }) : null,
            error ? null : loading ? h('p', { role: 'status', className: 'management-empty' }, 'Loading authorized plans…') : can(PERMISSIONS.PLANS_VIEW, session)
                ? h(ManagementPlanReview, { plans, filters: scopeFilters(filters), planId: plans.some(plan => String(plan.record_id) === String(selectedPlanId)) ? selectedPlanId : '', canComment: can(PERMISSIONS.OBJECTIVE_COMMENTS_CREATE, session), onOpenPlan: choosePlan, onBack: () => choosePlan('') })
                : h('div', { className: 'management-dashboard__errors', role: 'alert' }, 'You do not have permission to review strategic plans.'),
            h('footer', { className: 'management-dashboard__footer' }, '© 2026 Strategic Plan Development Management System. All rights reserved.'))));
}

const root = createPageRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading Management access…'));
apiRequest('/api/auth/me').then(payload => {
    const session = saveAccessSession(createAccessSession(payload.data));
    if (!enforcePageAccess()) return;
    if (!isManagementSession(session)) { window.location.replace('/access-denied'); return; }
    root.render(h(PlanReviewPage, { session }));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
