import { createStrategicPlan } from './api/strategic-plans-api.js';
import { AppSidebar } from './components/AppSidebar.js';
import { PageHeader } from './components/PageHeader.js';
import { StrategicPlanForm } from './strategic-plans/StrategicPlanForm.js';
import { enforcePageAccess } from './access/access-guard.js';

enforcePageAccess();

const { useState } = React;

function CreateStrategicPlanApp() {
    const [status, setStatus] = useState({ type: '', message: '' });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);

    async function submit(data, goNext) {
        setSubmitting(true); setErrors({}); setStatus({ type: 'info', message: 'Saving strategic plan…' });
        try {
            const payload = await createStrategicPlan(data);
            if (data.status === 'draft' && !goNext) {
                window.sessionStorage.setItem('planSuccessMessage', 'Draft strategic plan saved successfully.');
                window.location.href = '/strategic-plans';
                return;
            }
            if (goNext) {
                window.location.href = `/strategic-plans/${payload.data.record_id}/objectives`;
                return;
            }
            const pending = ' Planning period and department/agency require the reserved database columns before they can be persisted.';
            setStatus({ type: 'success', message: `${payload.message}${goNext ? ' The objectives step is reserved for the next module.' : ''}${pending}` });
        } catch (error) {
            setErrors(error.errors || {}); setStatus({ type: 'error', message: error.message });
        } finally { setSubmitting(false); }
    }

    return React.createElement(React.Fragment, null,
        React.createElement(AppSidebar, { onNotice: (message) => setStatus({ type: 'info', message }) }),
        React.createElement('main', { className: 'app-shell-main' }, React.createElement('div', { className: 'app-shell-container' },
            React.createElement(PageHeader, { section: 'Strategic Planning', title: 'Create Strategic Plan', subtitle: 'Provide basic information and the strategic foundation for the plan.' }),
            status.message ? React.createElement('div', { className: `ui-status ui-status--${status.type}`, role: 'status' }, status.message) : null,
            React.createElement(StrategicPlanForm, { mode: 'create', onSubmit: submit, submitting, serverErrors: errors })
        ))
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(CreateStrategicPlanApp));
