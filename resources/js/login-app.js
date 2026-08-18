import { BrandLogo } from './brand-logo.js';
import { createAccessSession, saveAccessSession } from './access/access-session.js';

const { useEffect, useState } = React;

const messages = {
    systemNotice: 'There are no system notices at this time.',
    help: 'Help resources are not connected yet.',
    contact: 'Contact details will be provided by the system administrator.',
    support: 'Support access is available for assigned users.',
    privacy: 'Privacy Notice content is not connected yet.',
    terms: 'Terms of Use content is not connected yet.',
    accessibility: 'Accessibility information is not connected yet.',
    version: 'Strategic Planning Management System, Version 1.0.',
    internalUse: 'This system is for internal government use only.',
};

const rootElement = document.getElementById('root');
const dashboardUrl = '/dashboard';
const apiConfig = {
    loginUrl: rootElement.dataset.loginUrl || '/api/auth/login',
};

async function loginRequest(credentials) {
    const response = await fetch(apiConfig.loginUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || 'Invalid credentials.');
    }

    return data;
}

async function currentUserRequest() {
    const response = await fetch('/api/me', { credentials: 'include', headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.data) throw new Error('Your access profile could not be loaded.');
    return payload.data;
}
function Brand() {
    return React.createElement(
        'a',
        { className: 'brand', href: '/login', 'aria-label': 'Strategic Planning Management System home' },
        React.createElement(BrandLogo),
        React.createElement('span', { className: 'brand-name' }, 'Strategic Planning Management System')
    );
}

function Header({ onMessage }) {
    return React.createElement(
        'header',
        { className: 'app-header', 'aria-label': 'Application header' },
        React.createElement(Brand),
        React.createElement(
            'nav',
            { className: 'top-nav', 'aria-label': 'Primary navigation' },
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.systemNotice) }, 'System Notice'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.contact) }, 'Contact support'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.help) }, 'Help')
        )
    );
}

function AccessIntro() {
    return React.createElement(
        'section',
        { className: 'access-intro', 'aria-labelledby': 'access-title' },
        React.createElement(
            'div',
            { className: 'access-icon', 'aria-hidden': 'true' },
            React.createElement(
                'svg',
                { viewBox: '0 0 64 64', role: 'img' },
                React.createElement('path', { d: 'M16 10h22a6 6 0 0 1 6 6v18a16 16 0 0 0-8-2V16H16v34h13a16 16 0 0 0 4 8H16a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6Z' }),
                React.createElement('path', { d: 'M23 20h8v8h-8zM23 34h8v8h-8zM16 22h4v4h-4zM16 36h4v4h-4z' }),
                React.createElement('path', { d: 'M45 36a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm6.8 9.9-7.5 8.2a2 2 0 0 1-2.9.1l-4.1-4.1 2.8-2.8 2.6 2.6 6.1-6.7 3 2.7Z' })
            )
        ),
        React.createElement('h1', { id: 'access-title' }, 'Access the Strategic Planning Management System'),
        React.createElement('p', null, 'For account access,', React.createElement('br'), 'please contact your system administrator.')
    );
}

function FieldError({ message }) {
    return React.createElement('p', { className: 'field-error' }, message || '');
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

function LoginForm({ status, setStatus }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const savedEmail = window.localStorage.getItem('spms.rememberedEmail');

        if (savedEmail) {
            setEmail(savedEmail);
            setRemember(true);
        }
    }, []);

    function validate() {
        const nextErrors = {};
        const emailValue = email.trim();

        if (!emailValue) {
            nextErrors.email = 'Please enter your email.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
            nextErrors.email = 'Please enter a valid email address.';
        }

        if (!password.trim()) {
            nextErrors.password = 'Please enter your password.';
        }

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    }

    async function handleSubmit(event) {
        event.preventDefault();

        if (!validate()) {
            setStatus('Check the highlighted fields and try again.', 'error');
            return;
        }

        setIsSubmitting(true);
        setStatus('Checking your sign in details...', 'info');

        try {
            const data = await loginRequest({
                email: email.trim(),
                password,
            });

            if (!data.success) {
                throw new Error(data.message || 'Unable to sign in.');
            }

            if (remember) {
                window.localStorage.setItem('spms.rememberedEmail', email.trim());
            } else {
                window.localStorage.removeItem('spms.rememberedEmail');
            }

            const user = await currentUserRequest();
            const accessSession = saveAccessSession(createAccessSession(user));
            if (accessSession.home === '/access-denied') {
                setStatus('Your account does not have an assigned application role.', 'error');
            } else {
                setStatus('Signed in successfully. Redirecting...', 'success');
            }
            setTimeout(() => {
                window.location.href = accessSession.home;
            }, 1000);
        } catch (error) {
            setStatus(error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    }

    return React.createElement(
        'section',
        { className: 'login-card', 'aria-labelledby': 'signin-title' },
        React.createElement(
            'div',
            { className: 'card-heading' },
            React.createElement('h2', { id: 'signin-title' }, 'Sign In'),
            React.createElement('p', null, 'Please sign in to continue...')
        ),
        React.createElement(
            'form',
            { className: 'login-form', noValidate: true, onSubmit: handleSubmit },
            React.createElement(
                'div',
                { className: `field-group ${errors.email ? 'has-error' : ''}` },
                React.createElement('label', { htmlFor: 'email' }, 'UserName'),
                React.createElement('input', {
                    id: 'email',
                    name: 'email',
                    type: 'email',
                    autoComplete: 'email',
                    placeholder: 'Enter your email id',
                    value: email,
                    onChange: (event) => setEmail(event.target.value),
                }),
                React.createElement(FieldError, { message: errors.email })
            ),
            React.createElement(
                'div',
                { className: `field-group ${errors.password ? 'has-error' : ''}` },
                React.createElement('label', { htmlFor: 'password' }, 'Password'),
                React.createElement(
                    'div',
                    { className: 'password-field' },
                    React.createElement('input', {
                        id: 'password',
                        name: 'password',
                        type: showPassword ? 'text' : 'password',
                        autoComplete: 'current-password',
                        placeholder: 'Enter your password',
                        value: password,
                        onChange: (event) => setPassword(event.target.value),
                    }),
                    React.createElement(
                        'button',
                        {
                            className: 'icon-button',
                            type: 'button',
                            'aria-label': showPassword ? 'Hide password' : 'Show password',
                            title: showPassword ? 'Hide password' : 'Show password',
                            'aria-pressed': showPassword,
                            onClick: () => setShowPassword(!showPassword),
                        },
                        React.createElement(EyeIcon, { hidden: !showPassword })
                    )
                ),
                React.createElement(FieldError, { message: errors.password })
            ),
            React.createElement(
                'div',
                { className: 'form-options' },
                React.createElement(
                    'label',
                    { className: 'remember-option' },
                    React.createElement('input', {
                        type: 'checkbox',
                        name: 'remember',
                        checked: remember,
                        onChange: (event) => setRemember(event.target.checked),
                    }),
                    React.createElement('span', null, 'Remember Me')
                ),
                React.createElement(
                    'button',
                    {
                        className: 'text-button',
                        type: 'button',
                        //onClick: () => setStatus('Please contact your system administrator to reset your password.', 'info'),
                        onClick: () => { window.location.href = '/forgot-password';
},
                    },
                    'Forgot Password?'
                )
            ),
            React.createElement('button', { className: 'signin-button', type: 'submit', disabled: isSubmitting }, isSubmitting ? 'Signing in...' : 'Sign in'),
            React.createElement('p', { className: `form-status is-${status.type}`, role: 'status', 'aria-live': 'polite' }, status.message),
            React.createElement('p', { className: 'access-note' }, "Access is granted based on the user's assigned role and permissions.")
        )
    );
}

const socialIcons = {
    x: 'M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.3 22H3.2l7.3-8.3L2.8 2h6.4l4.4 5.9L18.9 2Zm-1.1 18.1h1.7L8.3 3.8H6.5l11.3 16.3Z',
    instagram: 'M12 2.2c3.2 0 3.6 0 4.9.07 1.2.06 1.8.25 2.2.42.6.22 1 .48 1.4.9.4.4.7.8.9 1.4.17.4.36 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.06 1.2-.25 1.8-.42 2.2a3.9 3.9 0 0 1-.9 1.4c-.4.4-.8.7-1.4.9-.4.17-1 .36-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.06-1.8-.25-2.2-.42a3.9 3.9 0 0 1-1.4-.9 3.9 3.9 0 0 1-.9-1.4c-.17-.4-.36-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.06-1.2.25-1.8.42-2.2.22-.6.48-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.17 1-.36 2.2-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.7.07-1.1.05-1.7.24-2.1.4-.5.2-.9.44-1.3.84-.4.4-.64.8-.84 1.3-.16.4-.35 1-.4 2.1C2.6 9.9 2.6 10.3 2.6 12s0 2.1.06 3.3c.05 1.1.24 1.7.4 2.1.2.5.44.9.84 1.3.4.4.8.64 1.3.84.4.16 1 .35 2.1.4 1.2.06 1.6.06 4.7.06s3.5 0 4.7-.06c1.1-.05 1.7-.24 2.1-.4.5-.2.9-.44 1.3-.84.4-.4.64-.8.84-1.3.16-.4.35-1 .4-2.1.06-1.2.06-1.6.06-3.3s0-2.1-.06-3.3c-.05-1.1-.24-1.7-.4-2.1a3.5 3.5 0 0 0-.84-1.3 3.5 3.5 0 0 0-1.3-.84c-.4-.16-1-.35-2.1-.4C15.5 4 15.1 4 12 4Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 8a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2Zm6.2-8.2a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0Z',
    youtube: 'M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.7-1.7C19.3 5.2 12 5.2 12 5.2s-7.3 0-8.9.4A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.7 1.7c1.6.4 8.9.4 8.9.4s7.3 0 8.9-.4a2.5 2.5 0 0 0 1.7-1.7c.4-1.5.4-4.7.4-4.7ZM9.8 15.2V8.8l6 3.2-6 3.2Z',
    linkedin: 'M6.9 21.5H2.9V8.9h4V21.5ZM4.9 7.2A2.3 2.3 0 1 1 4.9 2.6a2.3 2.3 0 0 1 0 4.6ZM21.5 21.5h-4v-6.1c0-1.5 0-3.4-2-3.4-2.1 0-2.4 1.6-2.4 3.3v6.2h-4V8.9h3.8v1.7h.06a4.2 4.2 0 0 1 3.8-2.1c4 0 4.8 2.7 4.8 6.1v6.9Z',
};

function SocialIcon({ path, label }) {
    return React.createElement(
        'a',
        { className: 'social-link', href: '#', 'aria-label': label, onClick: (event) => event.preventDefault() },
        React.createElement(
            'svg',
            { viewBox: '0 0 24 24', 'aria-hidden': 'true' },
            React.createElement('path', { d: path })
        )
    );
}

function FooterColumn({ heading, items }) {
    return React.createElement(
        'div',
        { className: 'footer-column' },
        React.createElement('h3', null, heading),
        React.createElement(
            'ul',
            null,
            items.map((item) =>
                React.createElement(
                    'li',
                    { key: item.label },
                    item.onClick
                        ? React.createElement(
                              'a',
                              { href: '#', onClick: (event) => { event.preventDefault(); item.onClick(); } },
                              item.label
                          )
                        : React.createElement('span', null, item.label)
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
            'div',
            { className: 'footer-brand' },
            React.createElement(BrandLogo, { className: 'footer-logo' }),
            React.createElement(
                'div',
                { className: 'social-links' },
                React.createElement(SocialIcon, { path: socialIcons.x, label: 'X' }),
                React.createElement(SocialIcon, { path: socialIcons.instagram, label: 'Instagram' }),
                React.createElement(SocialIcon, { path: socialIcons.youtube, label: 'YouTube' }),
                React.createElement(SocialIcon, { path: socialIcons.linkedin, label: 'LinkedIn' })
            )
        ),
        React.createElement(FooterColumn, {
            heading: 'System',
            items: [
                { label: 'Strategic Planning Management System', onClick: () => onMessage(messages.version) },
                { label: 'For internal government use only' },
            ],
        }),
        React.createElement(FooterColumn, {
            heading: 'Support',
            items: [
                { label: 'Help', onClick: () => onMessage(messages.help) },
                { label: 'Contact Support', onClick: () => onMessage(messages.contact) },
                { label: 'Accessibility', onClick: () => onMessage(messages.accessibility) },
            ],
        }),
        React.createElement(FooterColumn, {
            heading: 'Information',
            items: [
                { label: 'Privacy Notice', onClick: () => onMessage(messages.privacy) },
                { label: 'Terms of use', onClick: () => onMessage(messages.terms) },
                { label: 'Version 1.0', onClick: () => onMessage(messages.version) },
            ],
        })
    );
}

function LoginApp() {
    const [status, setStatusState] = useState({ message: '', type: 'info' });

    function setStatus(message, type = 'info') {
        setStatusState({ message, type });
    }

    return React.createElement(
        'div',
        { className: 'login-shell' },
        React.createElement(Header, { onMessage: (message) => setStatus(message, 'info') }),
        React.createElement(
            'main',
            { className: 'login-main' },
            React.createElement(AccessIntro),
            React.createElement(LoginForm, { status, setStatus })
        ),
        React.createElement(Footer, { onMessage: (message) => setStatus(message, 'info') })
    );
}

ReactDOM.createRoot(rootElement).render(React.createElement(LoginApp));
