import { OfficeReferenceMaterials } from '../../components/OfficeReferenceMaterials.js';
import '../../../css/office-input.css';
import { getStrategicPlan } from '../../api/strategic-plans-api.js';
import { can } from '../../access/access-session.js';

const h = React.createElement;
export function OfficePlanInput({ planId, planOptions = [], onPlanChange = null, pageTitle = 'Submit Planning Inputs', description = 'Upload reference materials for the selected strategic plan.' }) {
    const [plan, setPlan] = React.useState(null);
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [attempt, setAttempt] = React.useState(0);
    const back = '/office?plan=' + encodeURIComponent(planId);
    React.useEffect(() => {
        let active = true;
        setLoading(true); setError(''); setPlan(null);
        getStrategicPlan(planId).then(result => { if (active) setPlan(result.data); })
            .catch(err => { if (active) setError(err.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [planId, attempt]);
    const allowed = plan?.status === 'draft' && can('strategic_documents.upload');
    return h('main', { className: 'office-content office-input-page', 'aria-busy': loading },
        h('header', null, !onPlanChange && h('a', { href: back }, '← Back to plan'), h('h1', null, pageTitle),
            h('p', null, description),
            onPlanChange && h('label', { className: 'office-input-plan-picker' }, h('span', null, 'Strategic plan'),
                h('select', { value: String(planId), onChange: event => onPlanChange(event.target.value) },
                    planOptions.map(option => h('option', { key: option.record_id, value: option.record_id }, `${String(option.record_id).padStart(4, '0')} · ${option.title}`))))),
        plan && h('div', { id: 'office-materials-panel' }, h(OfficeReferenceMaterials, { key: plan.record_id, plan, allowed, back })),
        loading && h('p', { role: 'status' }, 'Loading plan…'),
        error && h('div', { className: 'office-panel', role: 'alert' }, error,
            !plan && h('button', { onClick: () => setAttempt(attempt + 1) }, 'Retry')));
}
