import { AdministrativeAdminSidebar } from '../../components/AdministrativeAdminSidebar.js';
import { apiRequest } from '../../api/api-client.js';
import { can, getAccessSession } from '../../access/access-session.js';
import { PERMISSIONS } from '../../access/access-policy.js';

const { useState } = React;

const formConfigs = {
    agenda: {
        active: 'Agenda',
        title: 'Data Management--Agenda Item',
        subtitle: 'Create a new Presidential Agenda reference item for use across the system. All tabs use this form when editing or viewing an item.',
        cancelUrl: '/administrative-admin/reference-data',
        inactiveGuidance: 'Inactive items will not appear in selection lists.',
        fields: [
            { name: 'code', label: 'Code', type: 'text', placeholder: 'e.g. PA-01', help: 'Unique ID for the item', required: true },
            { name: 'title', label: 'Title', type: 'text', placeholder: 'Enter the title', help: 'Official title of the item', required: true },
            { name: 'description', label: 'Description', type: 'textarea', help: 'Brief summary (max 200 characters)', required: true, maxLength: 200 },
            { name: 'effective_date', label: 'Effective Date', type: 'date', help: 'Optional effective date', required: false },
            { name: 'note', label: 'Note', type: 'text', placeholder: 'Optional note', required: false },
        ],
    },
    template: {
        active: 'Templates',
        title: 'Template Management--Template Item',
        subtitle: 'Create a reusable planning template for use across the system. All tabs use this form when editing or viewing an item.',
        cancelUrl: '/administrative-admin/templates',
        inactiveGuidance: 'Inactive templates will not appear in selection lists.',
        fields: [
            { name: 'template_id', label: 'Template ID', type: 'text', placeholder: 'e.g. TPL-01', help: 'Unique ID for the template', required: true },
            { name: 'template_name', label: 'Template Name', type: 'text', placeholder: 'Enter the template name', help: 'Official name shown in template lists', required: true },
            { name: 'purpose', label: 'Template Purpose', type: 'textarea', help: 'Brief template purpose (max 200 characters)', required: true, maxLength: 200 },
            { name: 'status', label: 'Status', type: 'select', help: 'Set the current status of the template', required: true },
            { name: 'updated_date', label: 'Updated Date', type: 'date', help: 'Set the template update date', required: true },
            { name: 'note', label: 'Note', type: 'text', help: 'Version notes or usage guidance', required: true },
        ],
    },
};

function initialValues(config) {
    const values = config.fields.reduce((result, field) => ({
        ...result,
        [field.name]: field.type === 'select' ? 'active' : '',
    }), {});
    return values;
}

function Guidelines({ inactiveGuidance }) {
    const items = [
        { icon: 'bi-pin-angle-fill', tone: 'blue', text: 'Use clear and official words.' },
        { icon: 'bi-lightbulb-fill', tone: 'green', text: 'ID/codes must be unique.' },
        { icon: 'bi-eye-slash-fill', tone: 'orange', text: inactiveGuidance },
    ];

    return React.createElement('aside', { className: 'admin-guidelines', 'aria-labelledby': 'guidelines-title' },
        React.createElement('h2', { id: 'guidelines-title' }, 'Guidelines'),
        items.map((item) => React.createElement('div', { className: `admin-guideline admin-guideline--${item.tone}`, key: item.text },
            React.createElement('i', { className: `bi ${item.icon}`, 'aria-hidden': 'true' }),
            React.createElement('span', null, item.text)
        ))
    );
}

function FormField({ field, value, error, onChange, readOnly = false }) {
    const commonProps = {
        id: `admin-field-${field.name}`,
        name: field.name,
        value,
        required: field.required,
        'aria-invalid': Boolean(error),
        'aria-describedby': `${field.name}-help${error ? ` ${field.name}-error` : ''}`,
        onChange: (event) => onChange(field.name, event.target.value),
    };

    let control;
    if (field.type === 'textarea') {
        control = React.createElement('textarea', { ...commonProps, className: 'ui-textarea', rows: 5, maxLength: field.maxLength, readOnly });
    }
    else if (field.type === 'select') {
        control = React.createElement('select', { ...commonProps, className: 'ui-select', disabled: readOnly },
            React.createElement('option', { value: 'active' }, 'Active'),
            React.createElement('option', { value: 'inactive' }, 'Inactive')
        );
    }
    else {
        control = React.createElement('input', { ...commonProps, className: 'ui-input', type: field.type, placeholder: field.placeholder || '', readOnly });
    }

    return React.createElement('div', { className: `admin-form-field ui-field${error ? ' is-invalid' : ''}` },
        React.createElement('label', { className: 'ui-label', htmlFor: commonProps.id }, field.label, field.required ? React.createElement('span', { className: 'ui-required', 'aria-hidden': 'true' }, ' *') : null),
        React.createElement('div', { className: 'admin-form-control' },
            control,
            field.help ? React.createElement('p', { className: 'ui-help', id: `${field.name}-help` }, field.help) : null,
            error ? React.createElement('p', { className: 'ui-error', id: `${field.name}-error` }, error) : null
        )
    );
}

export function AdministrativeItemFormApp({ itemType = 'agenda' }) {
    const config = formConfigs[itemType] || formConfigs.agenda;
    const reviewMode = new URLSearchParams(window.location.search).get('mode') === 'review';
    const itemIdMatch = window.location.pathname.match(/\/([^/]+)\/edit$/);
    const itemId = itemIdMatch ? decodeURIComponent(itemIdMatch[1]) : '';
    const canManageAgenda = itemType === 'agenda' && can(PERMISSIONS.PRESIDENTIAL_AGENDA_MANAGE, getAccessSession());
    const [values, setValues] = useState(() => initialValues(config));
    const [errors, setErrors] = useState({});
    const [notice, setNotice] = useState(reviewMode ? { type: 'info', message: 'Review mode is read-only. Choose Update from the Actions menu to edit this item.' } : { type: '', message: '' });
    const [loading, setLoading] = useState(Boolean(itemId));
    const [saving, setSaving] = useState(false);

    React.useEffect(() => {
        if (!itemId || itemType !== 'agenda') return;
        apiRequest(`/api/presidential-agenda/${encodeURIComponent(itemId)}`)
            .then((payload) => {
                const item = payload.data || {};
                setValues({ code: item.code || '', title: item.title || '', description: item.description || '', status: item.status || 'active', effective_date: item.effective_date || '', note: item.note || '' });
            })
            .catch((error) => setNotice({ type: 'error', message: error.message }))
            .finally(() => setLoading(false));
    }, [itemId, itemType]);

    function updateValue(name, value) {
        setValues((current) => ({ ...current, [name]: value }));
        setErrors((current) => ({ ...current, [name]: '' }));
    }

    async function submit(event) {
        event.preventDefault();
        const nextErrors = config.fields.reduce((result, field) => {
            if (field.required && !String(values[field.name] || '').trim()) result[field.name] = `${field.label} is required.`;
            return result;
        }, {});
        setErrors(nextErrors);

        if (Object.keys(nextErrors).length) {
            setNotice({ type: 'error', message: 'Complete all required fields before saving.' });
            return;
        }

        setSaving(true);
        try {
            const payload = { ...values };
            if (!payload.effective_date) payload.effective_date = null;
            if (!payload.note) payload.note = null;
            const result = itemId
                ? await apiRequest(`/api/presidential-agenda/${encodeURIComponent(itemId)}`, { method: 'PUT', body: JSON.stringify(payload) })
                : await apiRequest('/api/presidential-agenda', { method: 'POST', body: JSON.stringify(payload) });
            setNotice({ type: 'success', message: result.message || 'Presidential Agenda item saved.' });
            window.setTimeout(() => { window.location.href = '/administrative-admin/reference-data?tab=agenda'; }, 500);
        } catch (error) {
            setErrors(error.errors || {});
            setNotice({ type: 'error', message: error.message });
        } finally { setSaving(false); }
    }

    return React.createElement(React.Fragment, null,
        React.createElement(AdministrativeAdminSidebar, { active: config.active, onNotice: (message) => setNotice({ type: 'info', message }) }),
        React.createElement('main', { className: 'app-shell-main reference-data-page admin-item-page' },
            React.createElement('div', { className: 'app-shell-container' },
                React.createElement('header', { className: 'admin-item-header' },
                    React.createElement('div', { className: 'admin-item-title' },
                        React.createElement('i', { className: 'bi bi-file-earmark-text-fill', 'aria-hidden': 'true' }),
                        React.createElement('h1', { className: 'ui-page-title' }, config.title)
                    ),
                    React.createElement('p', { className: 'ui-page-subtitle' }, config.subtitle)
                ),
                notice.message ? React.createElement('div', { className: `ui-status ui-status--${notice.type}`, role: 'status' }, notice.message) : null,
                itemType === 'template'
                    ? React.createElement('div', { className: 'ui-status ui-status--info', role: 'status' }, 'Template management is not connected: no template table or API exists in the current backend.')
                    : loading
                    ? React.createElement('p', { className: 'ui-help', role: 'status' }, 'Loading agenda item…')
                    : React.createElement('form', { className: 'admin-item-form', onSubmit: submit, noValidate: true },
                    React.createElement('section', { className: 'ui-card admin-form-panel', 'aria-labelledby': 'information-title' },
                        React.createElement('h2', { id: 'information-title' }, 'Information'),
                        React.createElement('div', { className: 'admin-form-fields' },
                            config.fields.map((field) => React.createElement(FormField, { key: field.name, field, value: values[field.name], error: errors[field.name], onChange: updateValue, readOnly: reviewMode }))
                        )
                    ),
                    React.createElement(Guidelines, { inactiveGuidance: config.inactiveGuidance }),
                    React.createElement('div', { className: 'admin-form-actions' },
                        React.createElement('a', { className: 'ui-button ui-button--secondary', href: config.cancelUrl }, reviewMode ? 'Back' : 'Cancel'),
                        reviewMode || !canManageAgenda ? null : React.createElement('button', { className: 'ui-button ui-button--primary', type: 'submit', disabled: saving }, saving ? 'Saving…' : 'Save')
                    )
                )
            )
        )
    );
}
