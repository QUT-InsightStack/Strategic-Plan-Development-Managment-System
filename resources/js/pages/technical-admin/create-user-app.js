import { mountProtectedPage } from '../../access/mount-protected-page.js';
import '../../resource-crud-config.js';
import { BrandLogo } from '../../brand-logo.js';
import { LogoutButton } from '../../components/LogoutButton.js';
import { logoutUser } from '../../api/auth-api.js';
import { resourceRequest } from '../../api/resource-api.js';

const { useEffect, useState } = React;

const rootElement = document.getElementById('root');
const crud = window.ResourceCrud;
const dashboardUrl = '/dashboard';
const profileUrl = '/profile';
const usersListUrl = '/user-management';
const loginUrl = '/login';
const usersApiUrl = '/api/users';

const schema = crud.getSchema('users');

// Field names grouped into the sections shown on the page. Anything in the
// schema that is not listed here still renders, under Account Details.
const sections = [
    {
        title: 'Personal Details',
        note: 'Basic identifying information for the new account holder.',
        fields: ['first_name', 'last_name', 'email', 'mobile'],
    },
    {
        title: 'Assignment',
        note: 'Unit, office and position are selected from approved lists.',
        fields: ['department', 'unit', 'office', 'position'],
    },
    {
        title: 'Account Details',
        note: 'Access level and initial sign in credentials.',
        fields: ['role_id', 'status', 'password'],
    },
];

function Brand() {
    return React.createElement(
        'a',
        { className: 'brand', href: dashboardUrl, 'aria-label': 'Strategic planning Management System home' },
        React.createElement(BrandLogo),
        React.createElement('span', { className: 'brand-name' }, 'Strategic planning Management System')
    );
}

function Header({ onMessage, onLogout }) {
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
            React.createElement(LogoutButton, { className: 'nav-link logout-link' })
        )
    );
}

function Footer() {
    return React.createElement(
        'footer',
        { className: 'app-footer' },
        React.createElement('span', null, 'Strategic Planning Management System'),
        React.createElement('span', null, 'For internal government use only'),
        React.createElement('a', { href: dashboardUrl }, 'Dashboard'),
        React.createElement('a', { href: usersListUrl }, 'Users')
    );
}

function EyeIcon({ hidden }) {
    if (hidden) {
        return React.createElement(
            'svg',
            { viewBox: '0 0 24 24', 'aria-hidden': 'true' },
            React.createElement('path', { d: 'M12 5c5.1 0 8.6 4.6 9.8 6.5a1 1 0 0 1 0 1C20.6 14.4 17.1 19 12 19s-8.6-4.6-9.8-6.5a1 1 0 0 1 0-1C3.4 9.6 6.9 5 12 5Zm0 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z' })
        );
    }

    return React.createElement(
        'svg',
        { viewBox: '0 0 24 24', 'aria-hidden': 'true' },
        React.createElement('path', { d: 'M3.3 2 22 20.7 20.7 22l-3.1-3.1A10.6 10.6 0 0 1 12 20C6.9 20 3.4 15.4 2.2 13.5a1 1 0 0 1 0-1A17.2 17.2 0 0 1 6.1 8L2 3.3 3.3 2Zm6.1 9.4a3.5 3.5 0 0 0 4.2 4.2l-4.2-4.2ZM12 4c5.1 0 8.6 4.6 9.8 6.5a1 1 0 0 1 0 1 18 18 0 0 1-2.3 2.8l-2.7-2.7A5 5 0 0 0 10.4 7L8.5 5.1A10.6 10.6 0 0 1 12 4Z' })
    );
}

function buildEmptyValues(fields) {
    return fields.reduce((values, field) => {
        values[field.name] = field.defaultValue ?? '';
        return values;
    }, {});
}

function toPayloadValue(value, field) {
    if (field.valueType === 'number') {
        if (value === '' || value === null || value === undefined) {
            return field.allowEmpty ? null : undefined;
        }

        return Number(value);
    }

    return typeof value === 'string' ? value.trim() : value;
}

function buildPayload(fields, values) {
    return fields.reduce((payload, field) => {
        const value = toPayloadValue(values[field.name], field);

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

function getValidationMessage(field, value) {
    if (!field.required && !field.requiredOnCreate) {
        return '';
    }

    if (value === '' || value === null || value === undefined) {
        return `${field.label} is required.`;
    }

    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())) {
        return 'Please enter a valid email address.';
    }

    if (field.name === 'password' && String(value).length < 16) {
        return 'Password must be at least 16 characters.';
    }

    return '';
}

function FormField({ field, value, error, options, showPassword, onTogglePassword, onChange }) {
    const isRequired = Boolean(field.required || field.requiredOnCreate);

    const commonProps = {
        id: field.name,
        name: field.name,
        value: value ?? '',
        onChange: (event) => onChange(event.target.value),
        'aria-invalid': Boolean(error),
    };

    let control;

    if (field.type === 'select') {
        const optionItems = field.options || options[field.name] || [];

        control = React.createElement(
            'select',
            commonProps,
            React.createElement('option', { value: '' }, 'Select an option'),
            optionItems.map((option) => {
                const optionValue = option.value ?? crud.resolveId(field.optionsResource, option);
                const optionLabel = option.label ?? crud.describeRecord(field.optionsResource, option);

                return React.createElement(
                    'option',
                    { key: String(optionValue), value: String(optionValue) },
                    optionLabel
                );
            })
        );
    } else if (field.name === 'password') {
        control = React.createElement(
            'div',
            { className: 'password-field' },
            React.createElement('input', {
                ...commonProps,
                type: showPassword ? 'text' : 'password',
                autoComplete: 'new-password',
                placeholder: 'Minimum 16 characters',
            }),
            React.createElement(
                'button',
                {
                    className: 'icon-button',
                    type: 'button',
                    'aria-label': showPassword ? 'Hide password' : 'Show password',
                    'aria-pressed': showPassword,
                    onClick: onTogglePassword,
                },
                React.createElement(EyeIcon, { hidden: !showPassword })
            )
        );
    } else {
        control = React.createElement('input', {
            ...commonProps,
            type: field.type || 'text',
            placeholder: field.placeholder || '',
        });
    }

    return React.createElement(
        'div',
        { className: `form-field ${error ? 'has-error' : ''}` },
        React.createElement(
            'label',
            { htmlFor: field.name },
            field.label,
            isRequired ? React.createElement('span', { className: 'required-mark' }, '*') : null
        ),
        control,
        React.createElement('p', { className: 'field-error' }, error || '')
    );
}

function CreateUserApp() {
    const fields = schema ? schema.fields : [];
    const [values, setValues] = useState(() => buildEmptyValues(fields));
    const [errors, setErrors] = useState({});
    const [options, setOptions] = useState({});
    const [status, setStatus] = useState({ message: '', type: 'info' });
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadOptions();
    }, []);

    function setStatusMessage(message, type = 'info') {
        setStatus({ message, type });
    }

    function handleLogout() {
        logoutUser()
            .catch(() => null)
            .finally(() => {
                window.location.href = loginUrl;
            });
    }

    async function loadOptions() {
        const optionFields = fields.filter((field) => field.optionsResource);

        try {
            const entries = await Promise.all(
                optionFields.map(async (field) => {
                    const response = await resourceRequest(`/api/${field.optionsResource}${field.optionQuery || ''}`);
                    const list = crud.extractData(response);
                    return [field.name, Array.isArray(list) ? list : []];
                })
            );

            setOptions(Object.fromEntries(entries));
        } catch (error) {
            setStatusMessage('Unable to load role options. Refresh the page to try again.', 'error');
        }
    }

    function updateValue(name, value) {
        setValues((current) => ({ ...current, [name]: value }));
        setErrors((current) => ({ ...current, [name]: '' }));
    }

    function validate() {
        const nextErrors = {};

        fields.forEach((field) => {
            const message = getValidationMessage(field, values[field.name]);

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
            setStatusMessage('Please complete the highlighted fields.', 'error');
            return;
        }

        setSaving(true);
        setStatusMessage('Creating user account...', 'info');

        try {
            await resourceRequest(usersApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(buildPayload(fields, values)),
            });

            setStatusMessage('User account created successfully.', 'success');
            window.setTimeout(() => {
                window.location.href = usersListUrl;
            }, 800);
        } catch (error) {
            const validationErrors = getErrorMap(error);
            setErrors(validationErrors);

            if (validationErrors.email) {
                setStatusMessage(validationErrors.email, 'error');
            } else {
                setStatusMessage(error.message || 'Unable to create the user account.', 'error');
            }
        } finally {
            setSaving(false);
        }
    }

    if (!schema) {
        return React.createElement(
            'div',
            { className: 'create-user-shell' },
            React.createElement(Header, { onMessage: setStatusMessage, onLogout: handleLogout }),
            React.createElement(
                'main',
                { className: 'create-user-main' },
                React.createElement(
                    'div',
                    { className: 'page-inner' },
                    React.createElement('p', { className: 'form-status is-error' }, 'The user form is not available.')
                )
            ),
            React.createElement(Footer)
        );
    }

    const groupedNames = sections.flatMap((section) => section.fields);
    const ungrouped = fields.filter((field) => !groupedNames.includes(field.name)).map((field) => field.name);

    function renderField(name) {
        const field = fields.find((item) => item.name === name);

        if (!field) {
            return null;
        }

        return React.createElement(FormField, {
            key: field.name,
            field,
            value: values[field.name],
            error: errors[field.name],
            options,
            showPassword,
            onTogglePassword: () => setShowPassword((current) => !current),
            onChange: (value) => updateValue(field.name, value),
        });
    }

    return React.createElement(
        'div',
        { className: 'create-user-shell' },
        React.createElement(Header, { onMessage: setStatusMessage, onLogout: handleLogout }),
        React.createElement(
            'main',
            { className: 'create-user-main' },
            React.createElement(
                'div',
                { className: 'page-inner' },
                React.createElement(
                    'nav',
                    { className: 'breadcrumb', 'aria-label': 'Breadcrumb' },
                    React.createElement('a', { href: dashboardUrl }, 'Dashboard'),
                    React.createElement('span', { 'aria-hidden': 'true' }, '/'),
                    React.createElement('a', { href: usersListUrl }, 'Users'),
                    React.createElement('span', { 'aria-hidden': 'true' }, '/'),
                    React.createElement('span', null, 'Create User Account')
                ),
                React.createElement(
                    'div',
                    { className: 'page-title' },
                    React.createElement('h1', null, 'Create User Account'),
                    React.createElement('p', null, 'Register a new system user and assign their role, unit and office.')
                ),
                React.createElement(
                    'form',
                    { className: 'form-card', noValidate: true, onSubmit: handleSubmit },
                    sections.map((section) =>
                        React.createElement(
                            'section',
                            { className: 'form-section', key: section.title },
                            React.createElement('h2', null, section.title),
                            React.createElement('p', { className: 'section-note' }, section.note),
                            React.createElement(
                                'div',
                                { className: 'form-grid' },
                                section.fields.map((name) => renderField(name))
                            )
                        )
                    ),
                    ungrouped.length
                        ? React.createElement(
                              'section',
                              { className: 'form-section' },
                              React.createElement('h2', null, 'Additional Details'),
                              React.createElement('p', { className: 'section-note' }, 'Other information held against this account.'),
                              React.createElement(
                                  'div',
                                  { className: 'form-grid' },
                                  ungrouped.map((name) => renderField(name))
                              )
                          )
                        : null,
                    React.createElement(
                        'div',
                        { className: 'form-actions' },
                        React.createElement('a', { className: 'action-button secondary', href: usersListUrl }, 'Cancel'),
                        React.createElement(
                            'button',
                            { className: 'action-button primary', type: 'submit', disabled: saving },
                            saving ? 'Creating...' : 'Create Account'
                        )
                    ),
                    React.createElement(
                        'p',
                        { className: `form-status is-${status.type}`, role: 'status', 'aria-live': 'polite' },
                        status.message
                    )
                )
            )
        ),
        React.createElement(Footer)
    );
}

mountProtectedPage(rootElement, () => React.createElement(CreateUserApp));
