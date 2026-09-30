import { BrandLogo } from '../../brand-logo.js';
import { LogoutButton } from '../../components/LogoutButton.js';
import { changePassword, getCurrentUser, logoutUser } from '../../api/auth-api.js';

const { useEffect, useRef, useState } = React;

const rootElement = document.getElementById('root');

const dashboardUrl = '/dashboard';
const profileUrl = '/profile';
const loginUrl = '/login';

const messages = {
    help: 'Help resources are not connected yet.',
    contact: 'Contact details will be provided by the system administrator.',
    privacy: 'Privacy Notice content is not connected yet.',
    terms: 'Terms of Use content is not connected yet.',
    accessibility: 'Accessibility information is not connected yet.',
};

function Brand() {
    return React.createElement(
        'a',
        {
            className: 'brand',
            href: dashboardUrl,
            'aria-label': 'Strategic Planning Management System home',
        },
        React.createElement(BrandLogo),
        React.createElement(
            'span',
            { className: 'brand-name' },
            'Strategic Planning Management System'
        )
    );
}

function Header({ onMessage, onLogout }) {
    return React.createElement(
        'header',
        {
            className: 'app-header',
            'aria-label': 'Application header',
        },
        React.createElement(Brand),
        React.createElement(
            'nav',
            {
                className: 'top-nav',
                'aria-label': 'Primary navigation',
            },
            React.createElement(
                'button',
                {
                    className: 'nav-link',
                    type: 'button',
                    onClick: () => {
                        window.location.href = dashboardUrl;
                    },
                },
                'Dashboard'
            ),
            React.createElement(
                'button',
                {
                    className: 'nav-link',
                    type: 'button',
                    onClick: () => {
                        window.location.href = profileUrl;
                    },
                },
                'Profile'
            ),
            React.createElement(
                'button',
                {
                    className: 'nav-link',
                    type: 'button',
                    onClick: () => onMessage(messages.help),
                },
                'Help'
            ),
            React.createElement(
                'button',
                {
                    className: 'nav-link',
                    type: 'button',
                    onClick: () => onMessage(messages.contact),
                },
                'Contact'
            ),
            React.createElement(LogoutButton)
        )
    );
}

function EyeIcon({ hidden }) {
    if (hidden) {
        return React.createElement(
            'svg',
            {
                viewBox: '0 0 24 24',
                'aria-hidden': 'true',
            },
            React.createElement('path', {
                d: 'M12 5c5.1 0 8.6 4.6 9.8 6.5a1 1 0 0 1 0 1C20.6 14.4 17.1 19 12 19s-8.6-4.6-9.8-6.5a1 1 0 0 1 0-1C3.4 9.6 6.9 5 12 5Zm0 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z',
            })
        );
    }

    return React.createElement(
        'svg',
        {
            viewBox: '0 0 24 24',
            'aria-hidden': 'true',
        },
        React.createElement('path', {
            d: 'M3.3 2 22 20.7 20.7 22l-3.1-3.1A10.6 10.6 0 0 1 12 20C6.9 20 3.4 15.4 2.2 13.5a1 1 0 0 1 0-1A17.2 17.2 0 0 1 6.1 8L2 3.3 3.3 2Zm6.1 9.4a3.5 3.5 0 0 0 4.2 4.2l-4.2-4.2ZM12 4c5.1 0 8.6 4.6 9.8 6.5a1 1 0 0 1 0 1 18 18 0 0 1-2.3 2.8l-2.7-2.7A5 5 0 0 0 10.4 7L8.5 5.1A10.6 10.6 0 0 1 12 4Z',
        })
    );
}

function PasswordField({
    id,
    label,
    value,
    error,
    showPassword,
    onToggle,
    onChange,
    autoComplete,
    placeholder,
    inputRef,
    describedBy = '',
    disabled = false,
}) {
    const [capsLockOn, setCapsLockOn] = useState(false);
    const errorId = `${id}-error`;
    const capsId = `${id}-caps`;
    const described = [error ? errorId : '', capsLockOn ? capsId : '', describedBy]
        .filter(Boolean)
        .join(' ') || undefined;
    const checkCapsLock = (event) =>
        setCapsLockOn(Boolean(event.getModifierState?.('CapsLock')));

    return React.createElement(
        'div',
        {
            className: `field-group ${error ? 'has-error' : ''}`,
        },
        React.createElement(
            'label',
            { htmlFor: id },
            label,
            React.createElement('span', { className: 'field-required', 'aria-hidden': 'true' }, ' *')
        ),
        React.createElement(
            'div',
            { className: 'password-field-wrapper' },
            React.createElement('input', {
                className: 'field-input',
                id,
                name: id,
                type: showPassword ? 'text' : 'password',
                value,
                autoComplete,
                placeholder,
                ref: inputRef,
                disabled,
                required: true,
                'aria-required': 'true',
                'aria-invalid': error ? 'true' : 'false',
                'aria-describedby': described,
                autoCapitalize: 'none',
                spellCheck: false,
                onChange: (event) => onChange(event.target.value),
                onKeyDown: checkCapsLock,
                onKeyUp: checkCapsLock,
                onBlur: () => setCapsLockOn(false),
            }),
            React.createElement(
                'button',
                {
                    className: 'password-toggle',
                    type: 'button',
                    'aria-label': showPassword
                        ? `Hide ${label}`
                        : `Show ${label}`,
                    title: showPassword
                        ? 'Hide password'
                        : 'Show password',
                    'aria-pressed': showPassword,
                    'aria-controls': id,
                    disabled,
                    onClick: onToggle,
                },
                React.createElement(EyeIcon, {
                    hidden: !showPassword,
                })
            )
        ),
        capsLockOn
            ? React.createElement('p', { className: 'caps-lock-note', id: capsId }, 'Caps Lock is on.')
            : null,
        React.createElement(
            'p',
            { className: 'field-error', id: errorId, role: error ? 'alert' : undefined },
            error || ''
        )
    );
}

const PASSWORD_RULES = [
    { label: 'At least 16 characters', test: (password) => password.length >= 16 },
    { label: 'At least one uppercase letter', test: (password) => /[A-Z]/.test(password) },
    { label: 'At least one lowercase letter', test: (password) => /[a-z]/.test(password) },
    { label: 'At least one number', test: (password) => /\d/.test(password) },
    { label: 'At least one special character', test: (password) => /[^A-Za-z0-9]/.test(password) },
];

function PasswordRequirements({ id, password, currentPassword, confirmPassword }) {
    const requirements = [
        ...PASSWORD_RULES.map((rule) => ({ label: rule.label, valid: rule.test(password) })),
        {
            label: 'Different from your current password',
            valid: Boolean(password) && password !== currentPassword,
        },
    ];
    const met = requirements.filter((requirement) => requirement.valid).length;
    const matches = Boolean(password) && Boolean(confirmPassword) && password === confirmPassword;

    return React.createElement(
        'div',
        { className: 'password-requirements', id },
        React.createElement(
            'div',
            { className: 'password-requirements__head' },
            React.createElement('h3', null, 'New password requirements'),
            React.createElement('span', { className: `password-requirements__count${met === requirements.length ? ' is-complete' : ''}` }, `${met} of ${requirements.length} met`)
        ),
        React.createElement(
            'div',
            { className: 'password-meter', 'aria-hidden': 'true' },
            React.createElement('span', { style: { width: `${(met / requirements.length) * 100}%` } })
        ),
        React.createElement(
            'ul',
            null,
            requirements.map((requirement) =>
                React.createElement(
                    'li',
                    { key: requirement.label, className: requirement.valid ? 'is-valid' : '' },
                    React.createElement('span', { className: 'password-requirements__mark', 'aria-hidden': 'true' }, requirement.valid ? '\u2713' : ''),
                    requirement.label,
                    React.createElement('span', { className: 'ui-visually-hidden' }, requirement.valid ? ' (met)' : ' (not met)')
                )
            )
        ),
        confirmPassword
            ? React.createElement(
                'p',
                { className: `password-match ${matches ? 'is-valid' : 'is-invalid'}`, 'aria-live': 'polite' },
                matches ? 'Passwords match.' : 'Passwords do not match yet.'
            )
            : null
    );
}

function ChangePasswordForm({ status, setStatus }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showCurrentPassword, setShowCurrentPassword] =
        useState(false);
    const [showNewPassword, setShowNewPassword] =
        useState(false);
    const [showConfirmPassword, setShowConfirmPassword] =
        useState(false);

    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentRef = useRef(null);
    const newRef = useRef(null);
    const confirmRef = useRef(null);
    const hasInput = Boolean(currentPassword || newPassword || confirmPassword);

    function passwordIsValid(password) {
        return PASSWORD_RULES.every((rule) => rule.test(password));
    }

    function focusFirstError(nextErrors) {
        const target = nextErrors.current_password ? currentRef
            : nextErrors.new_password ? newRef
            : nextErrors.confirm_password ? confirmRef
            : null;
        if (target) window.setTimeout(() => target.current?.focus(), 0);
    }

    function updateField(setter, field) {
        return (value) => {
            setter(value);
            if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
        };
    }

    function validate() {
        const nextErrors = {};

        if (!currentPassword) {
            nextErrors.current_password =
                'Current password is required.';
        }

        if (!newPassword) {
            nextErrors.new_password =
                'New password is required.';
        } else if (!passwordIsValid(newPassword)) {
            nextErrors.new_password =
                'New password does not meet the password requirements.';
        }

        if (!confirmPassword) {
            nextErrors.confirm_password =
                'Please confirm your new password.';
        } else if (newPassword !== confirmPassword) {
            nextErrors.confirm_password =
                'New password and confirmation do not match.';
        }

        if (
            currentPassword &&
            newPassword &&
            currentPassword === newPassword
        ) {
            nextErrors.new_password =
                'New password must be different from your current password.';
        }

        setErrors(nextErrors);
        focusFirstError(nextErrors);

        return Object.keys(nextErrors).length === 0;
    }

    function clearPasswordFields() {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        setShowCurrentPassword(false);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
    }

    function handleReset() {
        clearPasswordFields();
        setErrors({});
        setStatus('', 'info');
        currentRef.current?.focus();
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (isSubmitting) return;

        if (!validate()) {
            setStatus(
                'Please fix the highlighted fields and try again.',
                'error'
            );
            return;
        }

        // Shows the server's field errors. The current password is never
        // kept after a rejected attempt; the new password is kept unless the
        // server rejected it, so a typo in the current password does not mean
        // retyping everything.
        function applyBackendErrors(source) {
            const first = value => (Array.isArray(value) ? value[0] : value);
            const backendErrors = {};
            if (source.current_password) backendErrors.current_password = first(source.current_password);
            if (source.new_password) backendErrors.new_password = first(source.new_password);
            if (source.new_password_confirmation) backendErrors.confirm_password = first(source.new_password_confirmation);

            setErrors(backendErrors);
            focusFirstError(backendErrors);
            setCurrentPassword('');
            if (backendErrors.new_password || backendErrors.confirm_password) {
                setNewPassword('');
                setConfirmPassword('');
            }
        }

        setIsSubmitting(true);
        setStatus('', 'info');

        try {
            const data = await changePassword({
                        current_password: currentPassword,
                        new_password: newPassword,
                        new_password_confirmation: confirmPassword,
                    });

            if (data.success === false) {
                if (data.errors && typeof data.errors === 'object') {
                    applyBackendErrors(data.errors);

                    const error = new Error('Please fix the highlighted fields and try again.');
                    error.handled = true;
                    throw error;
                }

                throw new Error(
                    data.message ||
                    'Unable to update password.'
                );
            }

            clearPasswordFields();
            setErrors({});

            setStatus(
                data.message ||
                'Your password has been changed. Use the new password next time you sign in.',
                'success'
            );
        } catch (error) {
            if (!error.handled && error.errors && typeof error.errors === 'object' && Object.keys(error.errors).length) {
                applyBackendErrors(error.errors);
                setStatus('Please fix the highlighted fields and try again.', 'error');
                return;
            }
            if (!error.handled) clearPasswordFields();

            setStatus(
                error.message ||
                'Unable to update password.',
                'error'
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return React.createElement(
        'section',
        {
            className: 'password-card',
            'aria-labelledby': 'change-password-title',
        },
        React.createElement(
            'div',
            { className: 'password-card-header' },
            React.createElement(
                'h2',
                { id: 'change-password-title' },
                'Change Password'
            ),
            React.createElement(
                'p',
                null,
                'Enter your current password, then choose a new one that meets every requirement below.'
            )
        ),
        React.createElement(
            'form',
            {
                className: 'password-form',
                noValidate: true,
                onSubmit: handleSubmit,
                'aria-busy': isSubmitting ? 'true' : undefined,
            },
            status.message
                ? React.createElement(
                    'div',
                    {
                        className: `password-banner is-${status.type}`,
                        role: status.type === 'error' ? 'alert' : 'status',
                    },
                    React.createElement('span', { className: 'password-banner__icon', 'aria-hidden': 'true' }, status.type === 'success' ? '\u2713' : status.type === 'error' ? '!' : 'i'),
                    React.createElement(
                        'div',
                        null,
                        React.createElement('p', null, status.message),
                        status.type === 'success'
                            ? React.createElement('a', { href: profileUrl }, 'Back to My Profile')
                            : null
                    ),
                    React.createElement('button', { type: 'button', className: 'password-banner__close', onClick: () => setStatus('', 'info'), 'aria-label': 'Dismiss message' }, '\u00d7')
                )
                : null,
            React.createElement(PasswordField, {
                id: 'current_password',
                label: 'Current Password',
                value: currentPassword,
                error: errors.current_password,
                showPassword: showCurrentPassword,
                onToggle: () =>
                    setShowCurrentPassword(!showCurrentPassword),
                onChange: updateField(setCurrentPassword, 'current_password'),
                inputRef: currentRef,
                disabled: isSubmitting,
                autoComplete: 'current-password',
                placeholder: 'Enter your current password',
            }),
            React.createElement(PasswordField, {
                id: 'new_password',
                label: 'New Password',
                value: newPassword,
                error: errors.new_password,
                showPassword: showNewPassword,
                onToggle: () =>
                    setShowNewPassword(!showNewPassword),
                onChange: updateField(setNewPassword, 'new_password'),
                inputRef: newRef,
                disabled: isSubmitting,
                describedBy: 'password-requirements',
                autoComplete: 'new-password',
                placeholder: 'Enter your new password',
            }),
            React.createElement(PasswordRequirements, {
                id: 'password-requirements',
                password: newPassword,
                currentPassword,
                confirmPassword,
            }),
            React.createElement(PasswordField, {
                id: 'confirm_password',
                label: 'Confirm New Password',
                value: confirmPassword,
                error: errors.confirm_password,
                showPassword: showConfirmPassword,
                onToggle: () =>
                    setShowConfirmPassword(!showConfirmPassword),
                onChange: updateField(setConfirmPassword, 'confirm_password'),
                inputRef: confirmRef,
                disabled: isSubmitting,
                autoComplete: 'new-password',
                placeholder: 'Re-enter your new password',
            }),
            React.createElement(
                'div',
                {
                    className: 'password-actions form-actions',
                },
                React.createElement(
                    'button',
                    {
                        className: 'action-button secondary',
                        type: 'button',
                        disabled: isSubmitting || !hasInput,
                        onClick: handleReset,
                    },
                    'Clear'
                ),
                React.createElement(
                    'button',
                    {
                        className: 'action-button primary',
                        type: 'submit',
                        disabled: isSubmitting,
                    },
                    isSubmitting ? React.createElement('span', { className: 'password-spinner', 'aria-hidden': 'true' }) : null,
                    isSubmitting
                        ? 'Updating…'
                        : 'Update password'
                )
            )
        )
    );
}

function Footer({ onMessage }) {
    return React.createElement(
        'footer',
        { className: 'app-footer' },
        React.createElement(
            'span',
            null,
            String.fromCharCode(169),
            ' 2026 Strategic Planning Management System'
        ),
        React.createElement(
            'a',
            {
                href: '#',
                onClick: (event) => {
                    event.preventDefault();
                    onMessage(messages.privacy);
                },
            },
            'Privacy Notice'
        ),
        React.createElement(
            'a',
            {
                href: '#',
                onClick: (event) => {
                    event.preventDefault();
                    onMessage(messages.terms);
                },
            },
            'Terms of Use'
        ),
        React.createElement(
            'a',
            {
                href: '#',
                onClick: (event) => {
                    event.preventDefault();
                    onMessage(messages.accessibility);
                },
            },
            'Accessibility'
        )
    );
}

function ChangePasswordApp() {
    const [status, setStatusState] = useState({
        message: '',
        type: 'info',
    });

    function setStatus(message, type = 'info') {
        setStatusState({
            message,
            type,
        });
    }

    useEffect(() => {
        getCurrentUser()
            .catch((error) => {
                console.error(
                    'Authentication check failed:',
                    error
                );

                setStatus(
                    'Unable to verify your account.',
                    'error'
                );
            });
    }, []);

    function handleLogout() {
        logoutUser().finally(() => {
            localStorage.removeItem('auth_token');
            window.location.href = loginUrl;
        });
    }

    return React.createElement(
        'div',
        { className: 'profile-shell' },
        React.createElement(Header, {
            onMessage: (message) =>
                setStatus(message, 'info'),
            onLogout: handleLogout,
        }),
        React.createElement(
            'main',
            { className: 'profile-main' },
            React.createElement(
                'div',
                { className: 'page-inner' },
                React.createElement(
                    'div',
                    { className: 'page-title' },
                    React.createElement(
                        'a',
                        { className: 'password-back-link', href: profileUrl },
                        '\u2190 Back to My Profile'
                    ),
                    React.createElement(
                        'h1',
                        null,
                        'Change Password'
                    ),
                    React.createElement(
                        'p',
                        null,
                        'Manage the password used to access your account.'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'password-page-layout' },
                    React.createElement(
                        ChangePasswordForm,
                        {
                            status,
                            setStatus,
                        }
                    )
                )
            )
        ),
        React.createElement(Footer, {
            onMessage: (message) =>
                setStatus(message, 'info'),
        })
    );
}

ReactDOM
    .createRoot(rootElement)
    .render(
        React.createElement(ChangePasswordApp)
    );
