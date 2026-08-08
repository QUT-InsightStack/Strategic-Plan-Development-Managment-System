import { BrandLogo } from './brand-logo.js';
import { clearLogoutFlag } from './auth-session.js';

const { useEffect, useState } = React;

const messages = {
    help: 'Help resources are not connected yet.',
    contact: 'Contact details will be provided by the system administrator.',
    support: 'Support access is available for assigned users.',
    privacy: 'Privacy Notice content is not connected yet.',
    terms: 'Terms of Use content is not connected yet.',
    accessibility: 'Accessibility information is not connected yet.',
};

const rootElement = document.getElementById('root');
const dashboardUrl = '/dashboard';
const apiConfig = {
    loginUrl: rootElement.dataset.loginUrl || '/api/login',
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
function Brand() {
    return React.createElement(
        'a',
        { className: 'brand', href: '#', 'aria-label': 'Strategic planning Management System home' },
        React.createElement(BrandLogo),
        React.createElement('span', { className: 'brand-name' }, 'Strategic planning Management System')
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
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.help) }, 'Help'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.contact) }, 'Contact'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.support) }, 'Support')
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

            // Clear the logged-out marker so the back-navigation guard on
            // protected pages does not bounce this new session to login.
            clearLogoutFlag();

            setStatus('Signed in successfully. Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = dashboardUrl;
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
                React.createElement('label', { htmlFor: 'email' }, 'Email'),
                React.createElement('input', {
                    id: 'email',
                    name: 'email',
                    type: 'email',
                    autoComplete: 'email',
                    placeholder: 'Enter your email address',
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
                        placeholder: 'Enter your password.',
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
                        onClick: () => setStatus('Please contact your system administrator to reset your password.', 'info'),
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

function Footer({ onMessage }) {
    return React.createElement(
        'footer',
        { className: 'app-footer' },
        React.createElement('span', null, String.fromCharCode(169), ' 2026 Strategic Planning Management System'),
        React.createElement('a', { href: '#', onClick: (event) => { event.preventDefault(); onMessage(messages.privacy); } }, 'Privacy Notice'),
        React.createElement('a', { href: '#', onClick: (event) => { event.preventDefault(); onMessage(messages.terms); } }, 'Terms of Use'),
        React.createElement('a', { href: '#', onClick: (event) => { event.preventDefault(); onMessage(messages.accessibility); } }, 'Accessibility')
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
