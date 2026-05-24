const { useState, useEffect } = React;
const rootElement = document.getElementById('root');
const crud = window.ResourceCrud;

const modules = [
    { id: 'users', title: 'Users', description: 'Manage user accounts and active employees.' },
    { id: 'roles', title: 'Roles', description: 'Create and assign role definitions.' },
    { id: 'permissions', title: 'Permissions', description: 'Control module access and privileges.' },
    { id: 'missions', title: 'Mission', description: 'Maintain the organization mission statement.' },
    { id: 'visions', title: 'Vision', description: 'Maintain the organization vision statement.' },
    { id: 'core-values', title: 'Core Values', description: 'Add, edit, view, and delete core value entries.' },
    { id: 'strategic-records', title: 'Strategic Records', description: 'Review and maintain strategic plan records.' },
    { id: 'relations', title: 'Relations', description: 'Manage relationships between strategic items.' },
    { id: 'role-premissions', title: 'Role Permissions', description: 'Sync permissions for each role.' },
    { id: 'plan-core-values', title: 'Plan/Core Mapping', description: 'Link strategic records with core values.' },
    { id: 'logs', title: 'Activity Logs', description: 'Inspect audit and event history.' },
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
        { className: 'brand', href: '/dashboard.html', 'aria-label': 'Strategic planning Management System home' },
        React.createElement(
            'span',
            { className: 'brand-mark', 'aria-hidden': 'true' },
            React.createElement('span'),
            React.createElement('span'),
            React.createElement('span'),
            React.createElement('span')
        ),
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
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => window.location.href = '/profile.html' }, 'Profile'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.help) }, 'Help'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.contact) }, 'Contact'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(messages.support) }, 'Support'),
            React.createElement('button', { className: 'nav-link logout-link', type: 'button', onClick: onLogout }, 'Logout')
        )
    );
}

function ModuleCard({ module, count }) {
    const countLabel = count === undefined ? 'Loading...' : count !== null ? `${count} records` : 'Unavailable';

    return React.createElement(
        'article',
        { className: 'dashboard-card' },
        React.createElement('h3', null, module.title),
        React.createElement('p', null, module.description),
        React.createElement('p', { className: 'dashboard-count' }, countLabel),
        React.createElement(
            'div',
            { className: 'dashboard-actions' },
            React.createElement(
                'a',
                { className: 'action-button primary', href: `/resource.html?resource=${module.id}` },
                'Open'
            ),
            React.createElement(
                'a',
                { className: 'action-button secondary', href: `/resource.html?resource=${module.id}` },
                'Explore'
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
            modules.map(async (module) => {
                try {
                    if (crud?.getSchema(module.id)) {
                        const response = await crud.listResource(module.id);
                        return { id: module.id, count: Array.isArray(response.data) ? response.data.length : null };
                    }

                    const response = await fetch(`/api/${module.id}`, {
                        credentials: 'include',
                        headers: { Accept: 'application/json' },
                    });

                    if (!response.ok) {
                        throw new Error('Failed to load');
                    }

                    const data = await response.json();
                    const payload = data?.data ?? data;
                    return { id: module.id, count: Array.isArray(payload) ? payload.length : null };
                } catch (error) {
                    return { id: module.id, count: null };
                }
            })
        ).then((results) => {
            const nextCounts = results.reduce((acc, next) => ({ ...acc, [next.id]: next.count }), {});
            setCounts(nextCounts);
            setStatusMessage('Dashboard ready. Sample data is shown where APIs are unavailable.', 'success');
        });
    }

    function handleLogout() {
        fetch('/api/logout', {
            method: 'POST',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        })
            .then(() => {
                window.location.href = '/login.html';
            })
            .catch(() => {
                window.location.href = '/login.html';
            });
    }

    return React.createElement(
        'div',
        { className: 'profile-shell with-sidebar' },
        React.createElement(window.AppShell.Sidebar, { active: 'dashboard', onMessage: setStatusMessage, onLogout: handleLogout }),
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
                        { className: 'action-button secondary', href: '/profile.html' },
                        'Open Profile'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'dashboard-grid' },
                    modules.map((module) => React.createElement(ModuleCard, { key: module.id, module, count: counts[module.id] }))
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
