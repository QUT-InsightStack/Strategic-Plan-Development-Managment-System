import { apiRequest } from '../api/api-client.js';
import { getAccessSession } from '../access/access-session.js';

const { useEffect, useState } = React;
const h = React.createElement;

export function PasswordAssistanceResetForm({ requestId }) {
    const [request, setRequest] = useState(null);
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const payload = await apiRequest(
                    `/api/password-assistance-requests/${requestId}`
                );
                if (!cancelled) setRequest(payload.data);
            } catch (requestError) {
                if (!cancelled) setError(requestError.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [requestId]);

    const canReset =
        request?.status === 'accepted' &&
        Number(request.accepted_by) ===
            Number(getAccessSession()?.userId);

    async function submit(event) {
        event.preventDefault();
        if (saving || !canReset) return;

        setError('');

        if (!password || password !== confirmation) {
            setError('Enter a new password and matching confirmation.');
            return;
        }

        if (!window.confirm(
            `Reset the password for ${request.user_name} (${request.email})? Their existing sessions will be invalidated.`
        )) return;

        setSaving(true);

        try {
            const payload = await apiRequest(
                `/api/password-assistance-requests/${requestId}/reset`,
                {
                    method: 'POST',
                    body: JSON.stringify({
                        password,
                        password_confirmation: confirmation,
                    }),
                }
            );

            setRequest(payload.data);
            setPassword('');
            setConfirmation('');
            setSuccess(payload.message);
        } catch (requestError) {
            const fieldErrors = Object.values(requestError.errors || {})
                .flat()
                .join(' ');

            setError(fieldErrors || requestError.message);
        } finally {
            setSaving(false);
        }
    }

    return h('section', {
        className: 'ui-card',
        'aria-labelledby': 'assistance-reset-title',
    },
        h('div', { className: 'ui-card__body' },
            h('h2', { id: 'assistance-reset-title' }, 'Reset Account Password'),
            loading && h('p', { role: 'status' }, 'Loading accepted request…'),
            error && h('p', {
                className: 'ui-error',
                role: 'alert',
            }, error),
            success && h('p', {
                className: 'ui-status ui-status--success',
                role: 'status',
            }, success),
            request && h('p', null,
                `${request.user_name} — ${request.email || 'Account unavailable'}`
            ),
            !loading && request && !canReset && !success &&
                h('p', null,
                    'This request is closed or is not accepted by your account.'
                ),
            canReset && h('form', { onSubmit: submit },
                h('p', { className: 'ui-help' },
                    'Verify the requester’s identity before resetting. Provide the new password through your approved support channel.'
                ),
                h('div', { className: 'ui-field' },
                    h('label', {
                        className: 'ui-label',
                        htmlFor: 'assistance-password',
                    }, 'New password'),
                    h('input', {
                        id: 'assistance-password',
                        className: 'ui-input',
                        type: 'password',
                        autoComplete: 'new-password',
                        required: true,
                        disabled: saving,
                        value: password,
                        onChange: event => setPassword(event.target.value),
                    })
                ),
                h('div', { className: 'ui-field' },
                    h('label', {
                        className: 'ui-label',
                        htmlFor: 'assistance-confirmation',
                    }, 'Confirm new password'),
                    h('input', {
                        id: 'assistance-confirmation',
                        className: 'ui-input',
                        type: 'password',
                        autoComplete: 'new-password',
                        required: true,
                        disabled: saving,
                        value: confirmation,
                        onChange: event => setConfirmation(event.target.value),
                    })
                ),
                h('button', {
                    className: 'ui-button ui-button--primary',
                    type: 'submit',
                    disabled: saving,
                }, saving ? 'Resetting…' : 'Reset Password')
            ),
            h('a', {
                className: 'ui-button ui-button--secondary',
                href: '/user-management',
            }, 'Back to User Accounts')
        )
    );
}