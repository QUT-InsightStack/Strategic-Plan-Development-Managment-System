import { createPageRoot } from '../../navigation/page-root.js';
import { BrandLogo } from '../../brand-logo.js';
import { resetPassword } from '../../api/auth-api.js';

const { useState } = React;

const rootElement = document.getElementById('root');

const apiConfig = {
    resetPasswordUrl:
        rootElement?.dataset?.resetPasswordUrl || '/api/reset-password',
};

const initialToken = rootElement?.dataset?.token || '';
const initialEmail = rootElement?.dataset?.email || '';

function Brand() {
    return React.createElement(
        'a',
        {
            className: 'brand',
            href: '/login',
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

function Header() {
    return React.createElement(
        'header',
        {
            className: 'app-header',
            'aria-label': 'Application header',
        },
        React.createElement(Brand)
    );
}

function AccessIntro() {
    return React.createElement(
        'section',
        {
            className: 'access-intro',
            'aria-labelledby': 'reset-access-title',
        },
        React.createElement(
            'h1',
            { id: 'reset-access-title' },
            'Create a New Password'
        ),
        React.createElement(
            'p',
            null,
            'Set a new password for your account and return to sign in.'
        )
    );
}

function FieldError({ message }) {
    return React.createElement(
        'p',
        { className: 'field-error' },
        message || ''
    );
}

function ResetPasswordForm({ status, setStatus }) {
    const [email, setEmail] = useState(initialEmail);
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    function validate() {
        const nextErrors = {};

        if (!email.trim()) {
            nextErrors.email = 'Please enter your email.';
        }

        if (!password) {
            nextErrors.password = 'Please enter a new password.';
        } else if (password.length < 16) {
            nextErrors.password = 'Password must be at least 16 characters.';
        }
        if (!passwordConfirmation) {
            nextErrors.password_confirmation =
                'Please confirm your new password.';
        } else if (password !== passwordConfirmation) {
            nextErrors.password_confirmation =
                'Password and confirmation do not match.';
        }

        setErrors(nextErrors);

        return Object.keys(nextErrors).length === 0;
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (!validate()) {
            setStatus('Please check the highlighted fields and try again.', 'error');
            return;
        }

        setIsSubmitting(true);
        setStatus('Resetting password...', 'info');

        try {
            const data = await resetPassword({
                    token: initialToken,
                    email: email.trim(),
                    password,
                    password_confirmation: passwordConfirmation,
                }, apiConfig.resetPasswordUrl);

            setErrors({});
            setStatus(
                data.message || 'Password has been reset successfully. Please sign in.',
                'success'
            );

            window.setTimeout(() => {
                window.location.href = '/login';
            }, 1200);
        } catch (error) {
            setErrors(error.errors || {});
            setStatus(error.message || 'Unable to reset password.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    }

    return React.createElement(
        'section',
        {
            className: 'login-card',
            'aria-labelledby': 'reset-password-title',
        },
        React.createElement(
            'div',
            { className: 'card-heading' },
            React.createElement(
                'h2',
                { id: 'reset-password-title' },
                'Reset Password'
            ),
            React.createElement(
                'p',
                null,
                'Use the email address that received the reset link.'
            )
        ),
        React.createElement(
            'form',
            {
                className: 'login-form',
                noValidate: true,
                onSubmit: handleSubmit,
            },
            React.createElement(
                'div',
                {
                    className: `field-group ${errors.email ? 'has-error' : ''}`,
                },
                React.createElement('label', { htmlFor: 'email' }, 'Email'),
                React.createElement('input', {
                    id: 'email',
                    name: 'email',
                    type: 'email',
                    autoComplete: 'email',
                    value: email,
                    onChange: (event) => setEmail(event.target.value),
                }),
                React.createElement(FieldError, { message: errors.email?.[0] || errors.email })
            ),
            React.createElement(
                'div',
                {
                    className: `field-group ${errors.password ? 'has-error' : ''}`,
                },
                React.createElement('label', { htmlFor: 'password' }, 'New Password'),
                React.createElement('input', {
                    id: 'password',
                    name: 'password',
                    type: 'password',
                    autoComplete: 'new-password',
                    minLength: 16,
                    value: password,
                    onChange: (event) => setPassword(event.target.value),
                }),
                React.createElement(FieldError, { message: errors.password?.[0] || errors.password })
            ),
            React.createElement(
                'div',
                {
                    className: `field-group ${errors.password_confirmation ? 'has-error' : ''}`,
                },
                React.createElement(
                    'label',
                    { htmlFor: 'password_confirmation' },
                    'Confirm New Password'
                ),
                React.createElement('input', {
                    id: 'password_confirmation',
                    name: 'password_confirmation',
                    type: 'password',
                    autoComplete: 'new-password',
                    minLength: 16,
                    value: passwordConfirmation,
                    onChange: (event) => setPasswordConfirmation(event.target.value),
                }),
                React.createElement(FieldError, {
                    message:
                        errors.password_confirmation?.[0] || errors.password_confirmation,
                })
            ),
            React.createElement(
                'button',
                {
                    className: 'ui-button ui-button--primary signin-button',
                    type: 'submit',
                    disabled: isSubmitting || !initialToken,
                },
                isSubmitting ? 'Resetting...' : 'Reset Password'
            ),
            React.createElement(
                'p',
                {
                    className: `form-status is-${status.type}`,
                    role: 'status',
                    'aria-live': 'polite',
                },
                initialToken
                    ? status.message
                    : 'This password reset link is invalid.'
            )
        )
    );
}

function Footer() {
    return React.createElement(
        'footer',
        { className: 'app-footer' },
        React.createElement(
            'span',
            null,
            String.fromCharCode(169),
            ' 2026 Strategic Planning Management System'
        )
    );
}

function ResetPasswordApp() {
    const [status, setStatusState] = useState({
        message: '',
        type: 'info',
    });

    function setStatus(message, type = 'info') {
        setStatusState({ message, type });
    }

    return React.createElement(
        'div',
        { className: 'login-shell' },
        React.createElement(Header),
        React.createElement(
            'main',
            { className: 'login-main' },
            React.createElement(AccessIntro),
            React.createElement(ResetPasswordForm, { status, setStatus })
        ),
        React.createElement(Footer)
    );
}

createPageRoot(rootElement).render(React.createElement(ResetPasswordApp));
