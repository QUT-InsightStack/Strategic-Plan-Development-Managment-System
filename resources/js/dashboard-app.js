import { BrandLogo } from './brand-logo.js';
import { logout, guardAgainstBackNavigation } from './auth-session.js';
import { enforcePageAccess } from './access/access-guard.js';
import { can, clearAccessSession } from './access/access-session.js';
import { PERMISSIONS } from './access/access-policy.js';

enforcePageAccess();

const { useState, useEffect } = React;
const rootElement = document.getElementById('root');
const dashboardUrl = '/dashboard';
const profileUrl = '/profile';
const resourceUrl = '/resource';
const loginUrl = '/login';
const strategicPlanUrl = '/strategic-plan';
const userManagementUrl = '/user-management';

const modules = [
    { id: 'users', title: 'Users', description: 'Manage user accounts and active employees.', permission: PERMISSIONS.USERS_VIEW },
    { id: 'roles', title: 'Roles', description: 'Create and assign role definitions.', permission: PERMISSIONS.ROLES_VIEW },
    { id: 'permissions', title: 'Permissions', description: 'Control module access and privileges.', permission: PERMISSIONS.PERMISSIONS_VIEW },
    { id: 'strategic-foundations', title: 'Strategic Foundations', description: 'Manage your strategic goals and values.', permission: PERMISSIONS.FOUNDATIONS_VIEW },
    { id: 'strategic-records', title: 'Strategic Records', description: 'Review and maintain strategic plan records.', permission: PERMISSIONS.PLANS_VIEW },
    { id: 'relations', title: 'Relations', description: 'Manage relationships between strategic items.', permission: PERMISSIONS.MAPPINGS_MANAGE },
    { id: 'logs', title: 'Activity Logs', description: 'Inspect audit and event history.', permission: PERMISSIONS.LOGS_VIEW },
    { id: 'role-premissions', title: 'Role Permissions', description: 'Sync permissions for each role.', permission: PERMISSIONS.PERMISSIONS_VIEW },
    { id: 'plan-core-values', title: 'Plan Core Values', description: 'Link plans with core values.', permission: PERMISSIONS.FOUNDATIONS_VIEW },
];

const staticModules = [
    { id: 'strategic-plan', title: 'Strategic Plan', description: 'Manage Mission, Vision, and Core Values for your organisation.', href: strategicPlanUrl, permission: PERMISSIONS.PLANS_VIEW },
];

const visibleModules = modules.filter((module) => can(module.permission));
const visibleStaticModules = staticModules.filter((module) => can(module.permission));

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
        { className: 'brand', href: dashboardUrl, 'aria-label': 'Strategic Planning Management System home' },
        React.createElement(BrandLogo),
        React.createElement('span', { className: 'brand-name' }, 'Strategic Planning Management System')
    );
}

function Header({ onMessage, onLogout, loggingOut }) {
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
            React.createElement(
                'button',
                { className: 'nav-link logout-link', type: 'button', onClick: onLogout, disabled: loggingOut },
                loggingOut ? 'Signing out...' : 'Logout'
            )
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
                      { className: 'action-button secondary', href: userManagementUrl },
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
    const [loggingOut, setLoggingOut] = useState(false);

    useEffect(() => {
        guardAgainstBackNavigation();
        refreshCounts();
    }, []);

    function setStatusMessage(message, type = 'info') {
        setStatus({ message, type });
    }

    function refreshCounts() {
        setStatusMessage('Refreshing counts...', 'info');

        Promise.all(
            visibleModules.map((module) =>
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
        clearAccessSession();
        logout({
            onStart: () => {
                setLoggingOut(true);
                setStatusMessage('Signing you out...', 'info');
            },
            onError: (message) => setStatusMessage(message, 'error'),
        });
    }

    return React.createElement(
        'div',
        { className: 'profile-shell' },
        React.createElement(Header, { onMessage: setStatusMessage, onLogout: handleLogout, loggingOut }),
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
                    visibleStaticModules.map((module) => React.createElement(StaticModuleCard, { key: module.id, module })),
                    visibleModules.map((module) => React.createElement(ModuleCard, { key: module.id, module, count: counts[module.id] ?? null }))
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
