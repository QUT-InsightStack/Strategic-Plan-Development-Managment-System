import { createPageRoot } from '../../navigation/page-root.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { apiRequest } from '../../api/api-client.js';
import { listAuthorizedManagementPlans } from './management-data.js';
import { ManagementPlanReview } from './management-plan-review.js';
import { createAccessSession, saveAccessSession, can } from '../../access/access-session.js';
import { PERMISSIONS } from '../../access/access-policy.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { isManagementSession } from '../../access/management-access.js';

const h = React.createElement;

function PlanReviewPage({ session }) {
    const query = new URLSearchParams(window.location.search);
    const objectivesMode = query.get('view') === 'objectives';
    const [plans, setPlans] = React.useState([]);
    const [selectedPlanId, setSelectedPlanId] = React.useState(query.get('plan') || '');
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [attempt, setAttempt] = React.useState(0);
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
        listAuthorizedManagementPlans().then(rows => { if (active) setPlans(rows); })
            .catch(reason => { if (active) setError(reason.message || 'Unable to load authorized plans.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [attempt]);

    return h('div', { className: 'app-shell management-dashboard' },
        h(AppSidebar, { active: 'Planning Module' }),
        h('main', { className: 'app-shell-main' }, h('div', { className: 'management-dashboard__content' },
            h('header', { className: 'management-dashboard__header' },
                h('div', null, h('p', { className: 'management-dashboard__eyebrow' }, 'Management / Executive · Planning Module'),
                    h('h1', null, objectivesMode ? 'Objectives Review' : 'Plan Review'),
                    h('p', null, objectivesMode ? 'Choose a plan to inspect its objective summary and progress.' : 'Review strategic plan summaries, foundations and objectives.'))),
            error ? h('div', { className: 'management-dashboard__errors', role: 'alert' }, error, ' ', h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setAttempt(value => value + 1) }, 'Retry')) : null,
            error ? null : loading ? h('p', { role: 'status', className: 'management-empty' }, 'Loading authorized plans…') : can(PERMISSIONS.PLANS_VIEW, session)
                ? h(ManagementPlanReview, { plans, planId: selectedPlanId, mode: objectivesMode ? 'objectives' : 'plans', canComment: can(PERMISSIONS.OBJECTIVE_COMMENTS_CREATE, session), onOpenPlan: choosePlan, onBack: () => choosePlan('') })
                : h('div', { className: 'management-dashboard__errors', role: 'alert' }, 'You do not have permission to review strategic plans.'),
            h('footer', { className: 'management-dashboard__footer' }, '© 2026 Strategic Planning Management System. All rights reserved.'))));
}

const root = createPageRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading Management access…'));
apiRequest('/api/auth/me').then(payload => {
    const session = saveAccessSession(createAccessSession(payload.data));
    if (!enforcePageAccess()) return;
    if (!isManagementSession(session)) { window.location.replace('/access-denied'); return; }
    root.render(h(PlanReviewPage, { session }));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
