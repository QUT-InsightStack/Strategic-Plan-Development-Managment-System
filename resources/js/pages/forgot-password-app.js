import { BrandLogo } from '../brand-logo.js';

const { useState } = React;

const rootElement = document.getElementById('root');

const loginUrl = '/login';

const apiConfig = {
    forgotPasswordUrl:
        rootElement?.dataset?.forgotPasswordUrl || '/api/forgot-password',
};

const messages = {
    help: 'Help resources are not connected yet.',
    contact: 'Contact details will be provided by the system administrator.',
    support: 'Support access is available for assigned users.',
    privacy: 'Privacy Notice content is not connected yet.',
    terms: 'Terms of Use content is not connected yet.',
    accessibility: 'Accessibility information is not connected yet.',
};

function Brand() {
    return React.createElement(
        'a',
        {
            className: 'brand',
            href: loginUrl,
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

function Header({ onMessage }) {
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
            React.createElement(
                'button',
                {
                    className: 'nav-link',
                    type: 'button',
                    onClick: () => onMessage(messages.support),
                },
                'Support'
            )
        )
    );
}

function AccessIntro() {
    return React.createElement(
        'section',
        {
            className: 'access-intro',
            'aria-labelledby': 'access-title',
        },
        React.createElement(
            'div',
            {
                className: 'access-icon',
                'aria-hidden': 'true',
            },
            React.createElement(
                'svg',
                {
                    viewBox: '0 0 64 64',
                    role: 'img',
                },
                React.createElement('path', {
                    d: 'M16 10h22a6 6 0 0 1 6 6v18a16 16 0 0 0-8-2V16H16v34h13a16 16 0 0 0 4 8H16a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6Z',
                }),
                React.createElement('path', {
                    d: 'M23 20h8v8h-8zM23 34h8v8h-8zM16 22h4v4h-4zM16 36h4v4h-4z',
                }),
                React.createElement('path', {
                    d: 'M45 36a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm6.8 9.9-7.5 8.2a2 2 0 0 1-2.9.1l-4.1-4.1 2.8-2.8 2.6 2.6 6.1-6.7 3 2.7Z',
                })
            )
        ),
        React.createElement(
            'h1',
            { id: 'access-title' },
            'Reset Your Password'
        ),
        React.createElement(
            'p',
            null,
            'Recover access to your Strategic Planning',
            React.createElement('br'),
            'Management System account securely.'
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

function ForgotPasswordForm({ status, setStatus }) {
    const [email, setEmail] = useState('');
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    function validate() {
        const nextErrors = {};
        const emailValue = email.trim();

        if (!emailValue) {
            nextErrors.email = 'Please enter your email.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
            nextErrors.email = 'Please enter a valid email address.';
        }

        setErrors(nextErrors);

        return Object.keys(nextErrors).length === 0;
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (!validate()) {
            setStatus(
                'Please check the highlighted field and try again.',
                'error'
            );
            return;
        }

        setIsSubmitting(true);
        setStatus('Processing your request...', 'info');

        /*try {
            const response = await fetch(
                apiConfig.forgotPasswordUrl,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: email.trim(),
                    }),
                }
            );

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    'Unable to process the request. Please try again.'
                );
            }

            setErrors({});

            setStatus(
                'If an account exists for this email address, password reset instructions will be sent.',
                'success'
            );
        } catch (error) {
            setStatus(
                error.message ||
                    'Unable to process the request. Please try again.',
                'error'
            );
        } finally {
            setIsSubmitting(false);
        }*/
    
    setErrors({});

setStatus(
    'Your password recovery request has been submitted. If the account details are valid, a recovery password will be provided shortly by an authorised system administrator.',
    'success'
);

setIsSubmitting(false);
        }

    return React.createElement(
        'section',
        {
            className: 'login-card',
            'aria-labelledby': 'forgot-password-title',
        },
        React.createElement(
            'div',
            { className: 'card-heading' },
            React.createElement(
                'h2',
                { id: 'forgot-password-title' },
                'Forgot Password'
            ),
            React.createElement(
                'p',
                null,
                'Enter your registered email address to request password recovery assistance.'
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
                    className: `field-group ${
                        errors.email ? 'has-error' : ''
                    }`,
                },
                React.createElement(
                    'label',
                    { htmlFor: 'email' },
                    'Email'
                ),
                React.createElement('input', {
                    id: 'email',
                    name: 'email',
                    type: 'email',
                    autoComplete: 'email',
                    placeholder: 'Enter your email address',
                    value: email,
                    onChange: (event) => {
    setEmail(event.target.value);

    if (errors.email) {
        setErrors({});
    }
},
                }),
                React.createElement(FieldError, {
                    message: errors.email,
                })
            ),

            React.createElement(
                'button',
                {
                    className: 'ui-button ui-button--primary signin-button',
                    type: 'submit',
                    disabled: isSubmitting,
                },
                isSubmitting ? 'Submitting...' : 'Request Password Recovery'
            ),

            React.createElement(
                'p',
                {
                    className: `form-status is-${status.type}`,
                    role: 'status',
                    'aria-live': 'polite',
                },
                status.message
            ),

            React.createElement(
                'button',
                {
                    className: 'text-button',
                    type: 'button',
                    onClick: () => {
                        window.location.href = loginUrl;
                    },
                },
                'Back to Sign In'
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

function ForgotPasswordApp() {
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

    return React.createElement(
        'div',
        { className: 'login-shell' },

        React.createElement(Header, {
            onMessage: (message) => setStatus(message, 'info'),
        }),

        React.createElement(
            'main',
            { className: 'login-main' },

            React.createElement(AccessIntro),

            React.createElement(ForgotPasswordForm, {
                status,
                setStatus,
            })
        ),

        React.createElement(Footer, {
            onMessage: (message) => setStatus(message, 'info'),
        })
    );
}

ReactDOM
    .createRoot(rootElement)
    .render(
        React.createElement(ForgotPasswordApp)
    );