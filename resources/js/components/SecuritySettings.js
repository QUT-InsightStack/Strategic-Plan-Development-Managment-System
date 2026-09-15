/**
 * Security settings panel.
 *
 * Rendered by the Settings page. Kept as a component so the panel has one
 * implementation regardless of where it is mounted.
 */

import { apiRequest } from '../api/api-client.js';

const { useEffect, useMemo, useState } = React;

const SECURITY_FIELDS = [
    { key: 'session_timeout_minutes', label: 'Session Inactivity Timeout', hint: 'Minutes without activity before a user is automatically logged out.', unit: 'minutes' },
    { key: 'max_failed_login_attempts', label: 'Maximum Failed Login Attempts', hint: 'Failed passwords allowed before the account is locked.', unit: 'attempts' },
    { key: 'lockout_duration_minutes', label: 'Account Lockout Duration', hint: 'Minutes an account remains locked after reaching the limit.', unit: 'minutes' },
];

export function SecuritySettings() {
    // `values` stays null until the saved configuration arrives so that
    // placeholder numbers are never shown as if they were real settings.
    const [saved, setSaved] = useState(null);
    const [values, setValues] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});
    const [status, setStatus] = useState({ message: '', type: 'info' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        apiRequest('/api/security-settings')
            .then((response) => { setSaved(response.data); setValues(response.data); })
            .catch((error) => setStatus({ message: error.message, type: 'error' }));
    }, []);

    const isDirty = useMemo(
        () => Boolean(values && saved) && SECURITY_FIELDS.some(({ key }) => String(values[key]) !== String(saved[key])),
        [values, saved]
    );

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
        SECURITY_FIELDS.forEach(({ key, label }) => {
            if (!Number.isInteger(payload[key]) || payload[key] < 1) {
                errors[key] = `${label} must be a whole number of at least 1.`;
            }
        });
        return errors;
    }

    async function save(event) {
        event.preventDefault();

        const payload = Object.fromEntries(SECURITY_FIELDS.map(({ key }) => [key, Number(values[key])]));
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
            const response = await apiRequest('/api/security-settings', { method: 'PUT', body: JSON.stringify(payload) });
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

    const statusBanner = status.message
        ? React.createElement('div', { className: `ui-status ui-status--${status.type}`, role: 'status' }, status.message)
        : null;

    return React.createElement('section', { className: 'ui-card role-panel security-settings', 'aria-labelledby': 'security-settings-title' },
        React.createElement('div', { className: 'role-panel__header' },
            React.createElement('h2', { id: 'security-settings-title' }, 'Security Settings'),
            React.createElement('p', null, 'Configure authentication and session protection for all users.')),
        !values
            ? React.createElement('div', { className: 'role-panel__body security-settings__loading' },
                statusBanner || 'Loading security settings…')
            : React.createElement('form', { className: 'role-panel__body security-settings__form', onSubmit: save },
                ...SECURITY_FIELDS.map(({ key, label, hint, unit }) => {
                    const inputId = `security-${key}`;
                    const hintId = `${inputId}-hint`;
                    const errorId = `${inputId}-error`;
                    const fieldError = fieldErrors[key];

                    return React.createElement('div', { key, className: `security-settings__field${fieldError ? ' is-invalid' : ''}` },
                        React.createElement('label', { htmlFor: inputId }, React.createElement('strong', null, label)),
                        React.createElement('span', { className: 'security-settings__hint', id: hintId }, hint),
                        React.createElement('div', { className: 'security-settings__control' },
                            React.createElement('input', {
                                id: inputId,
                                className: 'ui-input',
                                type: 'number',
                                min: '1',
                                step: '1',
                                inputMode: 'numeric',
                                value: values[key],
                                disabled: saving,
                                'aria-describedby': fieldError ? `${hintId} ${errorId}` : hintId,
                                'aria-invalid': fieldError ? 'true' : undefined,
                                onChange: (event) => update(key, event.target.value),
                            }),
                            React.createElement('span', { className: 'security-settings__unit' }, unit)),
                        fieldError ? React.createElement('p', { className: 'ui-error', id: errorId }, fieldError) : null);
                }),
                statusBanner,
                React.createElement('div', { className: 'security-settings__actions' },
                    React.createElement('button', { className: 'ui-button ui-button--primary', type: 'submit', disabled: saving || !isDirty },
                        React.createElement('i', { className: 'bi bi-check2-circle' }),
                        saving ? 'Saving…' : 'Save Security Settings'),
                    React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: reset, disabled: saving || !isDirty }, 'Discard Changes'))));
}
