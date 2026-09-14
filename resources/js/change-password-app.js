import { BrandLogo } from './brand-logo.js';
import { LogoutButton } from './components/LogoutButton.js';

const { useEffect, useState } = React;

const rootElement = document.getElementById('root');

const dashboardUrl = '/dashboard';
const profileUrl = '/profile';
const loginUrl = '/login';

const apiConfig = {
    meUrl: rootElement?.dataset?.meUrl || '/api/me',
    changePasswordUrl:
        rootElement?.dataset?.changePasswordUrl || '/api/change-password',
};

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
            'Strategic planning Management System'
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
}) {
    return React.createElement(
        'div',
        {
            className: `field-group ${error ? 'has-error' : ''}`,
        },
        React.createElement(
            'label',
            { htmlFor: id },
            label
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
                onChange: (event) => onChange(event.target.value),
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
                    onClick: onToggle,
                },
                React.createElement(EyeIcon, {
                    hidden: !showPassword,
                })
            )
        ),
        React.createElement(
            'p',
            { className: 'field-error' },
            error || ''
        )
    );
}

function PasswordRequirements({ password }) {
    const requirements = [
        {
            label: 'At least 16 characters',
            valid: password.length >= 16,
        },
        {
            label: 'At least one uppercase letter',
            valid: /[A-Z]/.test(password),
        },
        {
            label: 'At least one lowercase letter',
            valid: /[a-z]/.test(password),
        },
        {
            label: 'At least one number',
            valid: /\d/.test(password),
        },
        {
            label: 'At least one special character',
            valid: /[^A-Za-z0-9]/.test(password),
        },
    ];

    return React.createElement(
        'div',
        { className: 'password-requirements' },
        React.createElement(
            'h3',
            null,
            'New password requirements'
        ),
        React.createElement(
            'ul',
            null,
            requirements.map((requirement) =>
                React.createElement(
                    'li',
                    {
                        key: requirement.label,
                        className: requirement.valid
                            ? 'is-valid'
                            : '',
                    },
                    requirement.label
                )
            )
        )
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

    function passwordIsValid(password) {
        return (
            password.length >= 16 &&
            /[A-Z]/.test(password) &&
            /[a-z]/.test(password) &&
            /\d/.test(password) &&
            /[^A-Za-z0-9]/.test(password)
        );
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
        setStatus('Password fields have been cleared.', 'info');
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (!validate()) {
            setStatus(
                'Please check the highlighted fields and try again.',
                'error'
            );
            return;
        }

        setIsSubmitting(true);
        setStatus('Updating password...', 'info');

        try {
            const response = await fetch(
                apiConfig.changePasswordUrl,
                {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        current_password: currentPassword,
                        new_password: newPassword,
                        new_password_confirmation: confirmPassword,
                    }),
                }
            );

            const data = await response
                .json()
                .catch(() => ({}));

            if (!response.ok) {
                if (
                    data.errors &&
                    typeof data.errors === 'object'
                ) {
                    const backendErrors = {};

                    if (data.errors.current_password) {
                        backendErrors.current_password =
                            Array.isArray(data.errors.current_password)
                                ? data.errors.current_password[0]
                                : data.errors.current_password;
                    }

                    if (data.errors.new_password) {
                        backendErrors.new_password =
                            Array.isArray(data.errors.new_password)
                                ? data.errors.new_password[0]
                                : data.errors.new_password;
                    }

                    if (data.errors.new_password_confirmation) {
                        backendErrors.confirm_password =
                            Array.isArray(
                                data.errors.new_password_confirmation
                            )
                                ? data.errors
                                    .new_password_confirmation[0]
                                : data.errors
                                    .new_password_confirmation;
                    }

                    setErrors(backendErrors);
                }

                throw new Error(
                    data.message ||
                    'Unable to update password.'
                );
            }

            if (data.success === false) {
                throw new Error(
                    data.message ||
                    'Unable to update password.'
                );
            }

            clearPasswordFields();
            setErrors({});

            setStatus(
                data.message ||
                'Password updated successfully.',
                'success'
            );
        } catch (error) {
            clearPasswordFields();

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
                'Update your account password securely.'
            )
        ),
        React.createElement(
            'form',
            {
                className: 'password-form',
                noValidate: true,
                onSubmit: handleSubmit,
            },
            React.createElement(PasswordField, {
                id: 'current_password',
                label: 'Current Password',
                value: currentPassword,
                error: errors.current_password,
                showPassword: showCurrentPassword,
                onToggle: () =>
                    setShowCurrentPassword(!showCurrentPassword),
                onChange: setCurrentPassword,
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
                onChange: setNewPassword,
                autoComplete: 'new-password',
                placeholder: 'Enter your new password',
            }),
            React.createElement(PasswordRequirements, {
                password: newPassword,
            }),
            React.createElement(PasswordField, {
                id: 'confirm_password',
                label: 'Confirm New Password',
                value: confirmPassword,
                error: errors.confirm_password,
                showPassword: showConfirmPassword,
                onToggle: () =>
                    setShowConfirmPassword(!showConfirmPassword),
                onChange: setConfirmPassword,
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
                        disabled: isSubmitting,
                        onClick: handleReset,
                    },
                    'Reset'
                ),
                React.createElement(
                    'button',
                    {
                        className: 'action-button primary',
                        type: 'submit',
                        disabled: isSubmitting,
                    },
                    isSubmitting
                        ? 'Updating...'
                        : 'Update Password'
                )
            ),
            React.createElement(
                'p',
                {
                    className:
                        `form-status password-status is-${status.type}`,
                    role: 'status',
                    'aria-live': 'polite',
                },
                status.message
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
        fetch(apiConfig.meUrl, {
            method: 'GET',
            credentials: 'include',
            headers: {
                Accept: 'application/json',
            },
        })
            .then((response) => {
                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    window.location.href = loginUrl;
                    return;
                }

                if (!response.ok) {
                    throw new Error(
                        'Unable to verify account.'
                    );
                }
            })
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
        fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: {
                Accept: 'application/json',
            },
        }).finally(() => {
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
