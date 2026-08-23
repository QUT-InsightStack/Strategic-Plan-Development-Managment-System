import { getStrategicPlan, updateStrategicPlan } from '../api/strategic-plans-api.js';
import { AppSidebar } from '../components/AppSidebar.js';
import { StrategicPlanForm } from '../strategic-plans/StrategicPlanForm.js';
import { enforcePageAccess } from '../access/access-guard.js';

enforcePageAccess();

const { useEffect, useState } = React;
const root = document.getElementById('root');
const planId = root.dataset.planId;

function EditStrategicPlanApp() {
    const [plan, setPlan] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState({ type: '', message: '' });

    useEffect(() => {
        getStrategicPlan(planId).then((payload) => setPlan(payload.data)).catch((error) => setStatus({ type: 'error', message: error.message })).finally(() => setLoading(false));
    }, []);

    async function submit(data) {
        setSubmitting(true); setErrors({}); setStatus({ type: 'info', message: 'Saving changes…' });
        try {
            await updateStrategicPlan(planId, data);
            window.sessionStorage.setItem('planSuccessMessage', 'Strategic plan updated successfully.');
            window.location.href = '/strategic-plans';
        } catch (error) { setErrors(error.errors || {}); setStatus({ type: 'error', message: error.message }); }
        finally { setSubmitting(false); }
    }

    return React.createElement(React.Fragment, null,
        React.createElement(AppSidebar, { onNotice: (message) => setStatus({ type: 'info', message }) }),
        React.createElement('main', { className: 'app-shell-main' }, React.createElement('div', { className: 'app-shell-container' },
            React.createElement('header', { className: 'app-page-header' }, React.createElement('div', null, React.createElement('h1', { className: 'ui-page-title' }, 'Update Strategic Plan'), React.createElement('p', { className: 'ui-page-subtitle' }, 'Update plan information and strategic foundation.'))),
            status.message ? React.createElement('div', { className: `ui-status ui-status--${status.type}`, role: 'status' }, status.message) : null,
            loading ? React.createElement('div', { className: 'ui-card ui-empty' }, 'Loading strategic plan…') : plan ? React.createElement(StrategicPlanForm, { mode: 'edit', initialData: plan, onSubmit: submit, submitting, serverErrors: errors }) : null
        ))
    );
}

ReactDOM.createRoot(root).render(React.createElement(EditStrategicPlanApp));
