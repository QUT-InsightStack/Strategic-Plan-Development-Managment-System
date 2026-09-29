import { AppSidebar } from '../../components/AppSidebar.js';
import { apiRequest } from '../../api/api-client.js';
import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { ManagementPlanReview } from './management-plan-review.js';
import { createAccessSession, saveAccessSession, can } from '../../access/access-session.js';
import { PERMISSIONS } from '../../access/access-policy.js';
import { enforcePageAccess } from '../../access/access-guard.js';

const h = React.createElement;
const allowedRoles = ['Management', 'Executive', 'Management / Executive'];

async function allAuthorizedPlans() {
    const plans = [];
    let page = 1;
    let lastPage = 1;
    do {
        const result = await listStrategicPlans({ page, per_page: 100 });
        plans.push(...(result.data || []));
        lastPage = Number(result.meta?.last_page || result.last_page || 1);
        page += 1;
    } while (page <= lastPage);
    return plans;
}

function PlanReviewPage({ session }) {
    const [plans, setPlans] = React.useState([]);
    const [selectedPlanId, setSelectedPlanId] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [attempt, setAttempt] = React.useState(0);

    React.useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        allAuthorizedPlans().then(rows => { if (active) setPlans(rows); })
            .catch(reason => { if (active) setError(reason.message || 'Unable to load authorized plans.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [attempt]);

    return h('div', { className: 'app-shell management-dashboard' },
        h(AppSidebar, { active: 'Planning Module' }),
        h('main', { className: 'app-shell-main' }, h('div', { className: 'management-dashboard__content' },
            h('header', { className: 'management-dashboard__header' },
                h('div', null, h('p', { className: 'management-dashboard__eyebrow' }, 'Management / Executive · Planning Module'),
                    h('h1', null, 'Plan Review'),
                    h('p', null, 'Review strategic plan summaries, foundations and objectives.'))),
            error ? h('div', { className: 'management-dashboard__errors', role: 'alert' }, error, ' ', h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setAttempt(value => value + 1) }, 'Retry')) : null,
            loading ? h('p', { role: 'status', className: 'management-empty' }, 'Loading authorized plans…') : can(PERMISSIONS.PLANS_VIEW, session)
                ? h(ManagementPlanReview, { plans, planId: selectedPlanId, onOpenPlan: id => setSelectedPlanId(String(id)), onBack: () => setSelectedPlanId('') })
                : h('div', { className: 'management-dashboard__errors', role: 'alert' }, 'You do not have permission to review strategic plans.'),
            h('footer', { className: 'management-dashboard__footer' }, '© 2026 Strategic Planning Management System. All rights reserved.'))));
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading Management access…'));
apiRequest('/api/auth/me').then(payload => {
    const session = saveAccessSession(createAccessSession(payload.data));
    if (!allowedRoles.includes(session.roleName)) { window.location.replace('/access-denied'); return; }
    if (enforcePageAccess()) root.render(h(PlanReviewPage, { session }));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
