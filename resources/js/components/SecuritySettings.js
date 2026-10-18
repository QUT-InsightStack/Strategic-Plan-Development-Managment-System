/**
 * Security settings panel.
 *
 * Rendered by the Settings page. Kept as a component so the panel has one
 * implementation regardless of where it is mounted.
 */

import { apiRequest } from '../api/api-client.js';

const { useEffect, useMemo, useState } = React;
const h = React.createElement;

const SECURITY_FIELDS = [
    { key: 'session_timeout_minutes', label: 'Session inactivity timeout', hint: 'Minutes without activity before a user is automatically signed out.', unit: 'minutes', icon: 'bi-hourglass-split' },
    { key: 'max_failed_login_attempts', label: 'Maximum failed sign-in attempts', hint: 'Wrong passwords allowed before the account is locked.', unit: 'attempts', icon: 'bi-shield-exclamation' },
    { key: 'lockout_duration_minutes', label: 'Account lockout duration', hint: 'Minutes an account stays locked after reaching the limit. It then unlocks automatically.', unit: 'minutes', icon: 'bi-lock' },
];

const plural = (value, unit) => `${value} ${Number(value) === 1 ? unit.replace(/s$/, '') : unit}`;

// Plain-language summary of the saved policy, shown beside the form.
function PolicySummary({ saved }) {
    const items = [
        ['bi-hourglass-split', `Users are signed out after ${plural(saved.session_timeout_minutes, 'minutes')} without activity.`],
        ['bi-shield-exclamation', `After ${plural(saved.max_failed_login_attempts, 'attempts')} with a wrong password, the account is locked.`],
        ['bi-lock', `A locked account unlocks automatically after ${plural(saved.lockout_duration_minutes, 'minutes')}.`],
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
    const [defaults, setDefaults] = useState({});
    const [fieldErrors, setFieldErrors] = useState({});
    const [status, setStatus] = useState({ message: '', type: 'info' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        apiRequest('/api/security-settings')
            .then((response) => { setSaved(response.data); setValues(response.data); setDefaults(response.meta?.defaults || {}); })
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
        ? h('div', { className: `ui-status ui-status--${status.type}`, role: status.type === 'error' ? 'alert' : 'status' }, status.message)
        : null;

    const form = h('section', { className: 'ui-card security-settings', 'aria-labelledby': 'security-settings-title' },
        h('header', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' },
                h('h2', { id: 'security-settings-title' }, 'Session and sign-in protection'),
                h('p', null, 'Applies to every user account in SPDMS.')),
            h('i', { className: 'bi bi-shield-lock', 'aria-hidden': true })),
        !values
            ? h('div', { className: 'security-settings__loading' }, statusBanner || 'Loading security settings…')
            : h('form', { className: 'security-settings__form', onSubmit: save, noValidate: true },
                SECURITY_FIELDS.map(({ key, label, hint, unit, icon }) => {
                    const inputId = `security-${key}`;
                    const hintId = `${inputId}-hint`;
                    const errorId = `${inputId}-error`;
                    const fieldError = fieldErrors[key];
                    const changed = saved && String(values[key]) !== String(saved[key]);

                    return h('div', { key, className: `security-settings__field${fieldError ? ' is-invalid' : ''}${changed ? ' is-changed' : ''}` },
                        h('span', { className: 'security-settings__icon' }, h('i', { className: `bi ${icon}`, 'aria-hidden': true })),
                        h('div', { className: 'security-settings__copy' },
                            h('label', { htmlFor: inputId }, label),
                            h('span', { className: 'security-settings__hint', id: hintId }, hint,
                                defaults[key] ? h('span', { className: 'security-settings__default' }, ` Default: ${plural(defaults[key], unit)}.`) : null),
                            fieldError ? h('p', { className: 'ui-error', id: errorId }, fieldError) : null),
                        h('div', { className: 'security-settings__control' },
                            h('input', {
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
                            h('span', { className: 'security-settings__unit' }, unit)));
                }),
                h('footer', { className: 'security-settings__actions' },
                    statusBanner || h('span', { className: 'security-settings__state' }, isDirty ? 'You have unsaved changes.' : 'All changes saved.'),
                    h('div', { className: 'security-settings__buttons' },
                        h('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: reset, disabled: saving || !isDirty }, 'Discard changes'),
                        h('button', { className: 'ui-button ui-button--primary', type: 'submit', disabled: saving || !isDirty },
                            h('i', { className: 'bi bi-check2-circle', 'aria-hidden': true }),
                            saving ? 'Saving…' : 'Save settings')))));

    return h('div', { className: 'security-settings-layout' }, form, saved ? h(PolicySummary, { saved }) : null);
}
