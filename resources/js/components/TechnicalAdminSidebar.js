import { BrandLogo } from '../brand-logo.js';
import { PERMISSIONS } from '../access/access-policy.js';
import { can, clearAccessSession, getAccessSession } from '../access/access-session.js';

const menuItems = [
    { label: 'Permission Control', icon: 'bi-shield-lock-fill', href: '/role-management', permission: PERMISSIONS.ROLES_MANAGE },
    { label: 'User Management', icon: 'bi-people-fill', permission: PERMISSIONS.USERS_VIEW },
    { label: 'Security Logs', icon: 'bi-list-check', permission: PERMISSIONS.LOGS_VIEW },
    { label: 'System Settings', icon: 'bi-gear-fill', permission: PERMISSIONS.SETTINGS_MANAGE },
    { label: 'FAQ', icon: 'bi-info-square-fill' },
];

export function TechnicalAdminSidebar({ onNotice = () => {} }) {
    const currentPath = window.location.pathname;
    const accessSession = getAccessSession();

    function logout() {
        clearAccessSession();
        fetch('/api/logout', { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } })
            .catch(() => null)
            .finally(() => { window.location.href = '/login'; });
    }

    return React.createElement('aside', { className: 'app-sidebar', 'aria-label': 'Technical administration navigation' },
        React.createElement('a', { className: 'app-sidebar__brand', href: accessSession?.home || '/login' },
            React.createElement(BrandLogo, { className: 'app-sidebar__logo' }),
            React.createElement('span', { className: 'app-sidebar__brand-copy' }, React.createElement('strong', null, 'SPDMS'), React.createElement('small', null, 'Strategic Planning System'))
        ),
        React.createElement('a', { className: 'app-sidebar__profile', href: '/profile' }, React.createElement('i', { className: 'bi bi-person-vcard-fill' }), React.createElement('span', null, 'Technical Administrator')),
        React.createElement('nav', { className: 'app-sidebar__nav' }, menuItems.filter((item) => !item.permission || can(item.permission, accessSession)).map((item) => item.href
            ? React.createElement('a', { key: item.label, href: item.href, className: `app-sidebar__item${currentPath === item.href ? ' active' : ''}` }, React.createElement('i', { className: `bi ${item.icon}` }), React.createElement('span', null, item.label))
            : React.createElement('button', { key: item.label, type: 'button', className: 'app-sidebar__item', onClick: () => onNotice(`${item.label} is reserved for a later module.`) }, React.createElement('i', { className: `bi ${item.icon}` }), React.createElement('span', null, item.label))
        )),
        React.createElement('button', { className: 'app-sidebar__item app-sidebar__logout', type: 'button', onClick: logout }, React.createElement('i', { className: 'bi bi-box-arrow-left' }), React.createElement('span', null, 'Log Out'))
    );
}
