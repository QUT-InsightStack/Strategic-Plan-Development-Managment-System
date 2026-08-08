import './resource-crud-config.js';
import { BrandLogo } from './brand-logo.js';
import { logout, guardAgainstBackNavigation } from './auth-session.js';

const { useEffect, useState } = React;

const rootElement = document.getElementById('root');
const crud = window.ResourceCrud;
const dashboardUrl = '/dashboard';
const profileUrl = '/profile';
const resourceUrl = '/resource';
const loginUrl = '/login';
const params = new URLSearchParams(window.location.search);
const resourceName = params.get('resource') || '';
const recordId = params.get('id') || '';
const schema = crud.getSchema(resourceName);
const apiUrl = resourceName ? `/api/${resourceName}` : '';

function Brand() {
    return React.createElement(
        'a',
        { className: 'brand', href: dashboardUrl, 'aria-label': 'Strategic planning Management System home' },
        React.createElement(BrandLogo),
        React.createElement('span', { className: 'brand-name' }, 'Strategic planning Management System')
    );
}

function Header({ onMessage, onLogout, loggingOut }) {
    return React.createElement(
        'header',
        { className: 'app-header', 'aria-label': 'Application header' },
        React.createElement(Brand),
        React.createElement(
            'nav',
            { className: 'top-nav', 'aria-label': 'Primary navigation' },
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => window.location.href = dashboardUrl }, 'Dashboard'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => window.location.href = profileUrl }, 'Profile'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(crud.messages.help) }, 'Help'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(crud.messages.contact) }, 'Contact'),
            React.createElement(
                'button',
                { className: 'nav-link logout-link', type: 'button', onClick: onLogout, disabled: loggingOut },
                loggingOut ? 'Signing out...' : 'Logout'
            )
        )
    );
}

function buildEmptyValues(currentSchema) {
    return currentSchema.fields.reduce((values, field) => {
        if (field.multiple) {
            values[field.name] = [];
        } else {
            values[field.name] = field.defaultValue ?? '';
        }

        return values;
    }, {});
}

function valueFromRecord(record, field) {
    if (!record) {
        return field.multiple ? [] : field.defaultValue ?? '';
    }

    if (field.name === 'name') {
        return record.name || [record.first_name, record.last_name].filter(Boolean).join(' ');
    }

    if (field.name === 'parent_ids' && Array.isArray(record.parents)) {
        return record.parents.map((parent) => crud.resolveId('strategic-records', parent)).filter(Boolean);
    }

    const value = record[field.name];

    if (field.multiple) {
        if (Array.isArray(value)) {
            return value;
        }

        return value ? [value] : [];
    }

    return value ?? field.defaultValue ?? '';
}

function toPayloadValue(value, field) {
    if (field.multiple) {
        const values = Array.isArray(value) ? value : [];
        return field.valueType === 'number'
            ? values.filter((item) => item !== '').map((item) => Number(item))
            : values.filter((item) => item !== '');
    }

    if (field.valueType === 'number') {
        if (value === '' || value === null || value === undefined) {
            return field.allowEmpty ? null : undefined;
        }

        return Number(value);
    }

    return typeof value === 'string' ? value.trim() : value;
}

function getValidationMessage(field, value, isEditMode) {
    const isRequired = field.required || (field.requiredOnCreate && !isEditMode);

    if (!isRequired) {
        return '';
    }

    if (field.multiple) {
        return Array.isArray(value) && value.length ? '' : `${field.label} is required.`;
    }

    return value !== '' && value !== null && value !== undefined ? '' : `${field.label} is required.`;
}

function buildPayload(fields, values, isEditMode) {
    return fields.reduce((payload, field) => {
        const rawValue = values[field.name];

        if (isEditMode && field.omitWhenBlankOnEdit && !String(rawValue || '').trim()) {
            return payload;
        }

        const value = toPayloadValue(rawValue, field);

        if (value !== undefined) {
            payload[field.name] = value;
        }

        return payload;
    }, {});
}

function getErrorMap(error) {
    const errors = error.body?.errors;

    if (!errors || typeof errors !== 'object') {
        return {};
    }

    return Object.entries(errors).reduce((mapped, [key, messages]) => {
        mapped[key] = Array.isArray(messages) ? messages[0] : String(messages);
        return mapped;
    }, {});
}

function FieldControl({ field, value, error, options, onChange, recordId: currentRecordId }) {
    const commonProps = {
        id: field.name,
        name: field.name,
        className: 'crud-input',
        value: value ?? '',
        onChange: (event) => onChange(event.target.value),
        placeholder: field.placeholder || '',
        'aria-invalid': Boolean(error),
    };

    const label = React.createElement(
        'label',
        { htmlFor: field.name },
        field.label,
        field.required || field.requiredOnCreate ? React.createElement('span', { className: 'required-mark' }, '*') : null
    );

    let control;

    if (field.type === 'textarea') {
        control = React.createElement('textarea', {
            ...commonProps,
            rows: field.rows || 4,
        });
    } else if (field.type === 'select') {
        const optionItems = field.options || options[field.name] || [];
        const selectValue = field.multiple ? (Array.isArray(value) ? value.map(String) : []) : String(value ?? '');

        control = React.createElement(
            'select',
            {
                ...commonProps,
                value: selectValue,
                multiple: Boolean(field.multiple),
                onChange: (event) => {
                    if (field.multiple) {
                        onChange(Array.from(event.target.selectedOptions).map((option) => option.value));
                        return;
                    }

                    onChange(event.target.value);
                },
            },
            !field.multiple && (field.allowEmpty || !field.required)
                ? React.createElement('option', { value: '' }, 'Select an option')
                : null,
            optionItems.map((option) => {
                const optionValue = option.value ?? crud.resolveId(field.optionsResource, option);
                const optionLabel = option.label ?? crud.describeRecord(field.optionsResource, option);
                const isSelfParent =
                    field.name === 'parent_ids' &&
                    currentRecordId &&
                    String(optionValue) === String(currentRecordId);

                return React.createElement(
                    'option',
                    { key: String(optionValue), value: String(optionValue), disabled: isSelfParent },
                    optionLabel
                );
            })
        );
    } else {
        control = React.createElement('input', {
            ...commonProps,
            type: field.type || 'text',
        });
    }

    return React.createElement(
        'div',
        { className: `crud-field ${field.fullWidth ? 'is-wide' : ''} ${error ? 'has-error' : ''}` },
        label,
        control,
        field.multiple ? React.createElement('p', { className: 'field-note' }, 'Hold Ctrl to choose more than one option.') : null,
        React.createElement('p', { className: 'field-error' }, error || '')
    );
}

function ResourceFormApp() {
    const isEditMode = Boolean(recordId);
    const [values, setValues] = useState(schema ? buildEmptyValues(schema) : {});
    const [errors, setErrors] = useState({});
    const [options, setOptions] = useState({});
    const [status, setStatus] = useState({ message: '', type: 'info' });
    const [loggingOut, setLoggingOut] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        guardAgainstBackNavigation();
        loadForm();
    }, []);

    function setStatusMessage(message, type = 'info') {
        setStatus({ message, type });
    }

    function handleLogout() {
        logout({
            onStart: () => {
                setLoggingOut(true);
                setStatusMessage('Signing you out...', 'info');
            },
            onError: (message) => setStatusMessage(message, 'error'),
        });
    }

    async function loadCurrentUser() {
        try {
            const response = await crud.requestJson('/api/me');
            return crud.extractData(response)?.user || crud.extractData(response);
        } catch (error) {
            return null;
        }
    }

    async function loadOptions() {
        const optionFields = schema.fields.filter((field) => field.optionsResource);
        const entries = await Promise.all(
            optionFields.map(async (field) => {
                const response = await crud.requestJson(`/api/${field.optionsResource}${field.optionQuery || ''}`);
                const list = crud.extractData(response);
                return [field.name, Array.isArray(list) ? list : []];
            })
        );

        return Object.fromEntries(entries);
    }

    async function loadRecord() {
        if (!isEditMode) {
            return null;
        }

        const response = await crud.requestJson(`${apiUrl}/${recordId}`);
        return crud.extractData(response);
    }

    async function loadForm() {
        if (!schema) {
            setStatusMessage('Resource not supported. Return to the dashboard and choose a listed module.', 'error');
            setLoading(false);
            return;
        }

        setLoading(true);
        setStatusMessage(isEditMode ? `Loading ${schema.singular.toLowerCase()}...` : `Preparing ${schema.singular.toLowerCase()} form...`, 'info');

        try {
            const [currentUser, loadedOptions, record] = await Promise.all([
                loadCurrentUser(),
                loadOptions(),
                loadRecord(),
            ]);

            const nextValues = schema.fields.reduce((mapped, field) => {
                let nextValue = valueFromRecord(record, field);

                if ((field.defaultFromCurrentUser || field.defaultOnEditFromCurrentUser) && !nextValue && currentUser?.user_id) {
                    nextValue = currentUser.user_id;
                }

                mapped[field.name] = field.multiple && !Array.isArray(nextValue) ? [] : nextValue;
                return mapped;
            }, {});

            setOptions(loadedOptions);
            setValues(nextValues);
            setStatusMessage(isEditMode ? `${schema.singular} loaded.` : `Create a new ${schema.singular.toLowerCase()}.`, 'success');
        } catch (error) {
            setStatusMessage(error.message || 'Unable to load the form.', 'error');
        } finally {
            setLoading(false);
        }
    }

    function updateValue(name, value) {
        setValues((current) => ({ ...current, [name]: value }));
        setErrors((current) => ({ ...current, [name]: '' }));
    }

    function validate() {
        const nextErrors = {};

        schema.fields.forEach((field) => {
            const message = getValidationMessage(field, values[field.name], isEditMode);

            if (message) {
                nextErrors[field.name] = message;
            }
        });

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (!validate()) {
            setStatusMessage('Please complete the required fields.', 'error');
            return;
        }

        setSaving(true);
        setStatusMessage(isEditMode ? 'Saving changes...' : 'Creating record...', 'info');

        try {
            const payload = buildPayload(schema.fields, values, isEditMode);

            await crud.requestJson(isEditMode ? `${apiUrl}/${recordId}` : apiUrl, {
                method: isEditMode ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            setStatusMessage(isEditMode ? 'Record updated successfully.' : 'Record created successfully.', 'success');
            window.setTimeout(() => {
                window.location.href = `${resourceUrl}?resource=${resourceName}`;
            }, 650);
        } catch (error) {
            const validationErrors = getErrorMap(error);
            setErrors(validationErrors);
            setStatusMessage(error.message || 'Save request failed.', 'error');
        } finally {
            setSaving(false);
        }
    }

    const title = schema ? `${isEditMode ? 'Edit' : 'Create'} ${schema.singular}` : 'Resource Form';

    return React.createElement(
        'div',
        { className: 'profile-shell' },
        React.createElement(Header, { onMessage: setStatusMessage, onLogout: handleLogout, loggingOut }),
        React.createElement(
            'main',
            { className: 'profile-main' },
            React.createElement(
                'div',
                { className: 'page-inner' },
                React.createElement(
                    'div',
                    { className: 'page-title' },
                    React.createElement('h1', null, title),
                    React.createElement('p', null, schema ? `Manage ${schema.title.toLowerCase()} with a structured CRUD form.` : 'Choose a resource from the dashboard.')
                ),
                React.createElement(
                    'div',
                    { className: 'resource-header-actions' },
                    React.createElement(
                        'a',
                        { className: 'action-button secondary', href: `${resourceUrl}?resource=${resourceName}` },
                        'Back to List'
                    )
                ),
                React.createElement(
                    'section',
                    { className: 'crud-form-card modern-card' },
                    loading
                        ? React.createElement('p', { className: 'empty-state' }, 'Loading form...')
                        : React.createElement(
                              'form',
                              { className: 'crud-form', noValidate: true, onSubmit: handleSubmit },
                              React.createElement(
                                  'div',
                                  { className: 'crud-form-grid' },
                                  schema.fields.map((field) =>
                                      React.createElement(FieldControl, {
                                          key: field.name,
                                          field,
                                          value: values[field.name],
                                          error: errors[field.name],
                                          options,
                                          recordId,
                                          onChange: (value) => updateValue(field.name, value),
                                      })
                                  )
                              ),
                              React.createElement(
                                  'div',
                                  { className: 'crud-form-actions' },
                                  React.createElement(
                                      'a',
                                      { className: 'action-button secondary', href: `${resourceUrl}?resource=${resourceName}` },
                                      'Cancel'
                                  ),
                                  React.createElement(
                                      'button',
                                      { className: 'action-button primary', type: 'submit', disabled: saving },
                                      saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Record'
                                  )
                              )
                          )
                ),
                React.createElement(
                    'p',
                    { className: `form-status modern-status is-${status.type}`, role: 'status' },
                    status.message
                )
            )
        )
    );
}

ReactDOM.createRoot(rootElement).render(React.createElement(ResourceFormApp));
