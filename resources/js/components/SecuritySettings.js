/**
 * Security settings panel.
 *
 * Rendered by the Settings page. Reads and writes the centralized system
 * settings (`/api/settings`, table `tblsystem_settings`), which is what the
 * backend enforces for sign-in, sessions, passwords and maintenance mode.
 */

import { apiRequest } from '../api/api-client.js';

const { useEffect, useMemo, useState } = React;
const h = React.createElement;

// Ranges mirror UpdateSystemSettingsRequest so errors are caught before saving.
const NUMBER_FIELDS = [
    { key: 'session_idle_timeout_minutes', label: 'Session inactivity timeout', hint: 'Minutes without activity before a user is automatically signed out.', unit: 'minutes', icon: 'bi-hourglass-split', min: 5, max: 120 },
    { key: 'login_attempt_limit', label: 'Maximum failed sign-in attempts', hint: 'Wrong passwords allowed before the account is locked.', unit: 'attempts', icon: 'bi-shield-exclamation', min: 3, max: 10 },
    { key: 'password_min_length', label: 'Minimum password length', hint: 'Applies when users set or change a password.', unit: 'characters', icon: 'bi-key', min: 15, max: 64 },
];

const TOGGLE_FIELDS = [
    { key: 'password_require_mixed_case', label: 'Require upper and lower case letters', hint: 'New passwords must mix upper and lower case.', icon: 'bi-type' },
    { key: 'password_require_numbers', label: 'Require numbers', hint: 'New passwords must include at least one number.', icon: 'bi-123' },
    { key: 'password_require_symbols', label: 'Require symbols', hint: 'New passwords must include at least one symbol.', icon: 'bi-asterisk' },
    { key: 'maintenance_enabled', label: 'Maintenance mode', hint: 'When on, only administrators who manage settings can use the system. Notify users before turning it on.', icon: 'bi-tools' },
];

const ALL_KEYS = [...NUMBER_FIELDS, ...TOGGLE_FIELDS].map(({ key }) => key);

const plural = (value, unit) => `${value} ${Number(value) === 1 ? unit.replace(/s$/, '') : unit}`;

// Plain-language summary of the saved policy, shown beside the form.
function PolicySummary({ saved }) {
    const rules = [
        saved.password_require_mixed_case && 'mixed case',
        saved.password_require_numbers && 'a number',
        saved.password_require_symbols && 'a symbol',
    ].filter(Boolean);
    const items = [
        ['bi-hourglass-split', `Users are signed out after ${plural(saved.session_idle_timeout_minutes, 'minutes')} without activity.`],
        ['bi-shield-exclamation', `After ${plural(saved.login_attempt_limit, 'attempts')} with a wrong password, the account is temporarily locked.`],
        ['bi-key', `Passwords need at least ${plural(saved.password_min_length, 'characters')}${rules.length ? `, including ${rules.join(', ')}` : ''}.`],
        ['bi-tools', saved.maintenance_enabled ? 'Maintenance mode is on. Only settings administrators can sign in.' : 'Maintenance mode is off.'],
    ];
    return h('aside', { className: 'ui-card settings-summary', 'aria-labelledby': 'settings-summary-title' },
        h('header', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' }, h('h2', { id: 'settings-summary-title' }, 'Current policy'), h('p', null, 'What the saved settings mean for users.')),
            h('i', { className: 'bi bi-info-circle', 'aria-hidden': true })),
        h('ul', null, items.map(([icon, text]) => h('li', { key: icon }, h('i', { className: `bi ${icon}`, 'aria-hidden': true }), h('span', null, text)))),
        h('p', { className: 'settings-summary__note' }, 'Changes apply to new sessions and sign-in attempts as soon as they are saved.'));
}

export function SecuritySettings() {
    // `values` stays null until the saved configuration arrives so that
    // placeholder numbers are never shown as if they were real settings.
    const [saved, setSaved] = useState(null);
    const [values, setValues] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [status, setStatus] = useState({ message: '', type: 'info' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        apiRequest('/api/settings')
            .then((response) => { setSaved(response.data); setValues(response.data); })
            .catch((error) => setStatus({ message: error.message, type: 'error' }));
    }, []);

    const changedKeys = useMemo(
        () => (values && saved ? ALL_KEYS.filter((key) => String(values[key]) !== String(saved[key])) : []),
        [values, saved]
    );
    const isDirty = changedKeys.length > 0;

    function update(key, value) {
        setValues((current) => ({ ...current, [key]: value }));
        setFieldErrors((current) => { const next = { ...current }; delete next[key]; return next; });
        setStatus({ message: '', type: 'info' });
    }

    function reset() {
        setValues(saved);
        setFieldErrors({});
        setStatus({ message: '', type: 'info' });
    }

    function validate(payload) {
        const errors = {};
        NUMBER_FIELDS.forEach(({ key, label, min, max }) => {
            if (key in payload && (!Number.isInteger(payload[key]) || payload[key] < min || payload[key] > max)) {
                errors[key] = `${label} must be a whole number from ${min} to ${max}.`;
            }
        });
        return errors;
    }

    async function save(event) {
        event.preventDefault();

        // The API takes real JSON integers and booleans, and only the changed keys.
        const numberKeys = NUMBER_FIELDS.map(({ key }) => key);
        const payload = Object.fromEntries(changedKeys.map((key) => [key, numberKeys.includes(key) ? Number(values[key]) : Boolean(values[key])]));
        const errors = validate(payload);

        if (Object.keys(errors).length) {
            setFieldErrors(errors);
            setStatus({ message: 'Correct the highlighted settings before saving.', type: 'error' });
            return;
        }

        setSaving(true);
        setFieldErrors({});
        setStatus({ message: '', type: 'info' });

        try {
            const response = await apiRequest('/api/settings', { method: 'PATCH', body: JSON.stringify(payload) });
            setSaved(response.data);
            setValues(response.data);
            setStatus({ message: response.message, type: 'success' });
        } catch (error) {
            const responseErrors = error.errors || {};
            setFieldErrors(Object.fromEntries(Object.entries(responseErrors).map(([key, messages]) => [key, [].concat(messages)[0]])));
            setStatus({
                message: Object.keys(responseErrors).length ? 'Correct the highlighted settings before saving.' : error.message,
                type: 'error',
            });
        } finally {
            setSaving(false);
        }
    }

    function renderField({ key, label, hint, icon }, control) {
        const inputId = `security-${key}`;
        const hintId = `${inputId}-hint`;
        const errorId = `${inputId}-error`;
        const fieldError = fieldErrors[key];
        const changed = changedKeys.includes(key);

        return h('div', { key, className: `security-settings__field${fieldError ? ' is-invalid' : ''}${changed ? ' is-changed' : ''}` },
            h('span', { className: 'security-settings__icon' }, h('i', { className: `bi ${icon}`, 'aria-hidden': true })),
            h('div', { className: 'security-settings__copy' },
                h('label', { htmlFor: inputId }, label),
                h('span', { className: 'security-settings__hint', id: hintId }, hint),
                fieldError ? h('p', { className: 'ui-error', id: errorId }, fieldError) : null),
            h('div', { className: 'security-settings__control' },
                control({ id: inputId, 'aria-describedby': fieldError ? `${hintId} ${errorId}` : hintId, 'aria-invalid': fieldError ? 'true' : undefined })));
    }

    const statusBanner = status.message
        ? h('div', { className: `ui-status ui-status--${status.type}`, role: status.type === 'error' ? 'alert' : 'status' }, status.message)
        : null;

    const form = h('section', { className: 'ui-card security-settings', 'aria-labelledby': 'security-settings-title' },
        h('header', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' },
                h('h2', { id: 'security-settings-title' }, 'System security'),
                h('p', null, 'Applies to every user account in SPDMS.')),
            h('i', { className: 'bi bi-shield-lock', 'aria-hidden': true })),
        !values
            ? h('div', { className: 'security-settings__loading' }, statusBanner || 'Loading security settings…')
            : h('form', { className: 'security-settings__form', onSubmit: save, noValidate: true },
                NUMBER_FIELDS.map((field) => renderField(field, (props) => [
                    h('input', {
                        ...props,
                        key: 'input',
                        className: 'ui-input',
                        type: 'number',
                        min: String(field.min),
                        max: String(field.max),
                        step: '1',
                        inputMode: 'numeric',
                        value: values[field.key],
                        disabled: saving,
                        onChange: (event) => update(field.key, event.target.value),
                    }),
                    h('span', { key: 'unit', className: 'security-settings__unit' }, field.unit),
                ])),
                TOGGLE_FIELDS.map((field) => renderField(field, (props) => h('input', {
                    ...props,
                    type: 'checkbox',
                    role: 'switch',
                    className: 'security-settings__switch',
                    checked: Boolean(values[field.key]),
                    disabled: saving,
                    onChange: (event) => update(field.key, event.target.checked),
                }))),
                h('footer', { className: 'security-settings__actions' },
                    statusBanner || h('span', { className: 'security-settings__state' }, isDirty ? 'You have unsaved changes.' : 'All changes saved.'),
                    h('div', { className: 'security-settings__buttons' },
                        h('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: reset, disabled: saving || !isDirty }, 'Discard changes'),
                        h('button', { className: 'ui-button ui-button--primary', type: 'submit', disabled: saving || !isDirty },
                            h('i', { className: 'bi bi-check2-circle', 'aria-hidden': true }),
                            saving ? 'Saving…' : 'Save settings')))));

    return h('div', { className: 'security-settings-layout' }, form, saved ? h(PolicySummary, { saved }) : null);
}
