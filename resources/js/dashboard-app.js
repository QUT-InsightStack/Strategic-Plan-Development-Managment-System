import { BrandLogo } from './brand-logo.js';

const { useState, useEffect } = React;
const rootElement = document.getElementById('root');
const dashboardUrl = '/dashboard';
const profileUrl = '/profile';
const resourceUrl = '/resource';
const loginUrl = '/login';
const strategicPlanUrl = '/strategic-plan';
const userSearchUrl = '/user-search';

const modules = [
    { id: 'users', title: 'Users', description: 'Manage user accounts and active employees.' },
    { id: 'roles', title: 'Roles', description: 'Create and assign role definitions.' },
    { id: 'permissions', title: 'Permissions', description: 'Control module access and privileges.' },
    { id: 'strategic-foundations', title: 'Strategic Foundations', description: 'Manage your strategic goals and values.' },
    { id: 'strategic-records', title: 'Strategic Records', description: 'Review and maintain strategic plan records.' },
    { id: 'relations', title: 'Relations', description: 'Manage relationships between strategic items.' },
    { id: 'logs', title: 'Activity Logs', description: 'Inspect audit and event history.' },
    { id: 'role-premissions', title: 'Role Permissions', description: 'Sync permissions for each role.' },
    { id: 'plan-core-values', title: 'Plan Core Values', description: 'Link plans with core values.' },
];

const staticModules = [
    { id: 'strategic-plan', title: 'Strategic Plan', description: 'Manage Mission, Vision, and Core Values for your organisation.', href: strategicPlanUrl },
];

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
        { className: 'brand', href: dashboardUrl, 'aria-label': 'Strategic planning Management System home' },
        React.createElement(BrandLogo),
        React.createElement('span', { className: 'brand-name' }, 'Strategic planning Management System')
    );
}

function Header({ onMessage, onLogout }) {
    return React.createElement(
        'header',
        { className: 'app-header', 'aria-label': 'Application header' },
        React.createElement(Brand),
        React.createElement(
            'nav',
            { className: 'top-nav', 'aria-label': 'Primary navigation' },
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => window.location.href = profileUrl }, 'Profile'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.help) }, 'Help'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.contact) }, 'Contact'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.support) }, 'Support'),
            React.createElement('button', { className: 'nav-link logout-link', type: 'button', onClick: onLogout }, 'Logout')
        )
    );
}

function ModuleCard({ module, count }) {
    return React.createElement(
        'article',
        { className: 'dashboard-card' },
        React.createElement('h3', null, module.title),
        React.createElement('p', null, module.description),
        React.createElement('p', { className: 'dashboard-count' }, count !== null ? `${count} records` : 'Loading...'),
        React.createElement(
            'div',
            { className: 'dashboard-actions' },
            React.createElement(
                'a',
                { className: 'action-button primary', href: `${resourceUrl}?resource=${module.id}` },
                'Open'
            ),
            module.id === 'users'
                ? React.createElement(
                      'a',
                      { className: 'action-button secondary', href: userSearchUrl },
                      'Search Users'
                  )
                : React.createElement(
                      'a',
                      { className: 'action-button secondary', href: `${resourceUrl}?resource=${module.id}` },
                      'Explore'
                  )
        )
    );
}

function StaticModuleCard({ module }) {
    return React.createElement(
        'article',
        { className: 'dashboard-card' },
        React.createElement('h3', null, module.title),
        React.createElement('p', null, module.description),
        React.createElement(
            'div',
            { className: 'dashboard-actions', style: { marginTop: 'auto' } },
            React.createElement(
                'a',
                { className: 'action-button primary', href: module.href },
                'Open'
            )
        )
    );
}

function DashboardApp() {
    const [counts, setCounts] = useState({});
    const [status, setStatus] = useState({ message: '', type: 'info' });

    useEffect(() => {
        refreshCounts();
    }, []);

    function setStatusMessage(message, type = 'info') {
        setStatus({ message, type });
    }

    function refreshCounts() {
        setStatusMessage('Refreshing counts...', 'info');

        Promise.all(
            modules.map((module) =>
                fetch(`/api/${module.id}`, {
                    credentials: 'include',
                    headers: { Accept: 'application/json' },
                })
                    .then((response) => {
                        if (!response.ok) {
                            if (response.status === 401 || response.status === 403) {
                                window.location.href = loginUrl;
                            }
                            throw new Error('Failed to load');
                        }
                        return response.json();
                    })
                    .then((data) => {
                        const payload = data?.data ?? data;
                        if (Array.isArray(payload)) {
                            return { id: module.id, count: payload.length };
                        }
                        return { id: module.id, count: null };
                    })
                    .catch(() => ({ id: module.id, count: null }))
            )
        ).then((results) => {
            const nextCounts = results.reduce((acc, next) => ({ ...acc, [next.id]: next.count }), {});
            setCounts(nextCounts);
            setStatusMessage('Dashboard ready.', 'success');
        });
    }

    function handleLogout() {
        fetch('/api/logout', {
            method: 'POST',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        })
            .then(() => {
                window.location.href = loginUrl;
            })
            .catch(() => {
                window.location.href = loginUrl;
            });
    }

    return React.createElement(
        'div',
        { className: 'profile-shell' },
        React.createElement(Header, { onMessage: setStatusMessage, onLogout: handleLogout }),
        React.createElement(
            'main',
            { className: 'profile-main' },
            React.createElement(
                'div',
                { className: 'page-inner' },
                React.createElement(
                    'div',
                    { className: 'page-title' },
                    React.createElement('h1', null, 'Application Dashboard'),
                    React.createElement('p', null, 'Access protected resources, review available modules, and manage your profile.')
                ),
                React.createElement(
                    'div',
                    { className: 'dashboard-actions-bar' },
                    React.createElement(
                        'button',
                        { className: 'action-button primary', type: 'button', onClick: refreshCounts },
                        'Refresh Counts'
                    ),
                    React.createElement(
                        'a',
                        { className: 'action-button secondary', href: profileUrl },
                        'Open Profile'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'dashboard-grid' },
                    staticModules.map((module) => React.createElement(StaticModuleCard, { key: module.id, module })),
                    modules.map((module) => React.createElement(ModuleCard, { key: module.id, module, count: counts[module.id] ?? null }))
                ),
                React.createElement(
                    'p',
                    { className: `form-status is-${status.type}` },
                    status.message
                )
            )
        )
    );
}

ReactDOM.createRoot(rootElement).render(React.createElement(DashboardApp));
