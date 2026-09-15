import { OfficeReferenceMaterials } from './components/OfficeReferenceMaterials.js';
import '../css/office-input.css';
import { getStrategicPlan } from './api/strategic-plans-api.js';
import { can, getAccessSession } from './access/access-session.js';
import { listLocalAgencyInputs, resubmitLocalAgencyInput, saveLocalAgencyInput } from './office-demo-storage.js';

const h = React.createElement;
export function OfficePlanInput({ planId }) {
    const [panel, setPanel] = React.useState('materials');
    const [plan, setPlan] = React.useState(null);
    const [error, setError] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [busy, setBusy] = React.useState(false);
    const [submitted, setSubmitted] = React.useState(false);
    const [attempt, setAttempt] = React.useState(0);
    const [values, setValues] = React.useState({});
    const [type, setType] = React.useState('objective');
    const [history, setHistory] = React.useState([]);
    const [revision, setRevision] = React.useState(null);
    const [historyError, setHistoryError] = React.useState('');
    React.useEffect(() => { const session = getAccessSession(); try { setHistory(listLocalAgencyInputs({ plan_id: planId, created_by: session?.userId, per_page: 100 }).data); setHistoryError(''); } catch (err) { setHistoryError(err.message); } }, [planId, submitted, attempt]);
    const back = '/office?plan=' + encodeURIComponent(planId);
    React.useEffect(() => {
        let active = true;
        setLoading(true); setError(''); setPlan(null);
        getStrategicPlan(planId).then(result => { if (active) setPlan(result.data); })
            .catch(err => { if (active) setError(err.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [planId, attempt]);
    const allowed = plan?.status === 'draft' && can('strategic_objectives.create');
    async function submit(event) {
        event.preventDefault();
        if (!allowed || busy || submitted) return;
        setBusy(true); setError('');
        try {
            if (revision) resubmitLocalAgencyInput(revision.id, { ...values, type, version: revision.version });
            else saveLocalAgencyInput(plan, { ...values, type }, getAccessSession());
            setSubmitted(true);
        } catch (err) {
            setError([err.message, ...Object.values(err.errors || {}).flat()].join(' '));
        } finally { setBusy(false); }
    }
    const field = (name, label, required = false, multiline = false) => h('label', { className: 'office-field-group', key: name },
        label + (required ? ' *' : ''), h(multiline ? 'textarea' : 'input', {
            name, required, value: values[name] || '', rows: multiline ? 4 : undefined,
            onChange: event => setValues(current => ({ ...current, [name]: event.target.value })),
        }));
    return h('main', { className: 'office-content office-input-page', 'aria-busy': loading },
        h('header', null, h('a', { href: back }, '← Back to plan'), h('h1', null, 'Submit Planning Inputs'),
            h('p', null, 'Prepare reference materials for the selected plan, or submit an objective or core value for review.')),
        h('nav', { className: 'office-input-tabs', 'aria-label': 'Submission options' },
            h('button', { type: 'button', 'aria-pressed': panel === 'materials', 'aria-controls': 'office-materials-panel', onClick: () => setPanel('materials') }, 'Reference Materials'),
            h('button', { type: 'button', 'aria-pressed': panel === 'planning', 'aria-controls': 'office-planning-panel', onClick: () => setPanel('planning') }, 'Planning Input')),
        plan && h('div', { id: 'office-materials-panel', hidden: panel !== 'materials' }, h(OfficeReferenceMaterials, { key: plan.record_id, plan, allowed, back })),
        loading && h('p', { role: 'status' }, 'Loading plan…'),
        error && h('div', { className: 'office-panel', role: 'alert' }, error,
            !plan && h('button', { onClick: () => setAttempt(attempt + 1) }, 'Retry')),
        plan && h('section', { className: 'office-panel', id: 'office-planning-panel', hidden: panel !== 'planning' }, h('h2', null, `${plan.record_id} · ${plan.title}`),
            submitted ? h('div', { role: 'status' }, h('p', null, 'Input submitted successfully for review.'), h('a', { href: back }, 'Return to plan'))
            : allowed ? h('form', { onSubmit: submit },
                h('fieldset', { className: 'office-workflow-fields', disabled: busy },
                    h('legend', null, revision ? 'Revise returned input' : 'Planning input'),
                    h('label', { className: 'office-field-group' }, 'Input type', h('select', { value: type, disabled: Boolean(revision), onChange: event => { setType(event.target.value); setValues({}); } }, h('option', { value: 'objective' }, 'Objective'), h('option', { value: 'core_value' }, 'Core value'))),
                    type === 'core_value' ? field('content', 'Proposed core value', true, true) : h(React.Fragment, null,
                    field('objective_title', 'Objective title', true),
                    field('objective_description', 'Description', true, true),
                    field('expected_outcome', 'Expected outcome', false, true),
                    field('indicator', 'Indicator'), field('target', 'Target')),
                    h('div', { className: 'office-detail-actions' }, h('a', { href: back }, 'Cancel'),
                        h('button', { type: 'submit', disabled: busy || (type === 'core_value' ? !values.content?.trim() : !values.objective_title?.trim() || !values.objective_description?.trim()) }, busy ? 'Submitting…' : 'Submit Input'))))
            : h('p', null, 'Inputs are available only for draft plans when your account has permission.')),
        h('section', { className: 'office-panel office-saved-inputs', hidden: panel !== 'planning' }, h('h2', null, 'Your submitted inputs'), historyError && h('p', { role: 'alert' }, historyError, h('button', { onClick: () => setAttempt(attempt + 1) }, 'Retry')), !historyError && !history.length && h('p', null, 'No submitted inputs yet.'), history.map(item => h('article', { className: 'office-update', key: item.id }, h('strong', null, item.payload.objective_title || item.payload.content), h('p', null, 'Status: ' + item.status), item.review_note && h('p', null, 'Review note: ' + item.review_note), item.status === 'returned' && allowed && h('button', { disabled: busy, onClick: () => { setRevision(item); setType(item.type); setValues(item.payload); setSubmitted(false); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, 'Revise and resubmit'))))); 
}


