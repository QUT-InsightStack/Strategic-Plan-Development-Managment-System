import { BrandLogo } from '../brand-logo.js';
import { PERMISSIONS } from '../access/access-policy.js';
import { can, getAccessSession } from '../access/access-session.js';
import { displayRoleName } from '../access/role-labels.js';
import { LogoutButton } from './LogoutButton.js';

const { useState } = React;

const accessItems = [
    { label: 'User Account Management', icon: 'bi-people-fill', href: '/user-management', permission: PERMISSIONS.USERS_VIEW },
    { label: 'Role Management', icon: 'bi-person-gear', href: '/role-management', permission: PERMISSIONS.ROLES_MANAGE },
    { label: 'Access Permission Management', icon: 'bi-shield-lock-fill', href: '/role-management?section=permissions', permission: PERMISSIONS.PERMISSIONS_MANAGE },
];

const securityItems = [
    { label: 'Login History', icon: 'bi-clock-history', href: '/login-history', permission: PERMISSIONS.LOGS_VIEW },
    { label: 'Security Logs', icon: 'bi-shield-exclamation', notice: 'Security Logs is reserved for its implementation page.', permission: PERMISSIONS.LOGS_VIEW },
    { label: 'Audit Logs', icon: 'bi-journal-check', notice: 'Audit Logs is reserved for its implementation page.', permission: PERMISSIONS.LOGS_VIEW },
    { label: 'System Security', icon: 'bi-shield-check', notice: 'System Security is reserved for its implementation page.', permission: PERMISSIONS.SETTINGS_MANAGE },
    { label: 'System Maintenance', icon: 'bi-tools', href: '/manual-backup', permission: PERMISSIONS.BACKUPS_VIEW },
];

export function TechnicalAdminSidebar({ onNotice = () => {} }) {
    const currentPath = window.location.pathname;
    const currentSection = new URLSearchParams(window.location.search).get('section');
    const accessSession = getAccessSession();
    const [openMenus, setOpenMenus] = useState({ access: true, security: true });

    function toggle(menu) {
        setOpenMenus((current) => ({ ...current, [menu]: !current[menu] }));
    }

    function renderSubitem(item) {
        if (item.permission && !can(item.permission, accessSession)) return null;
        const isPermissionPage = item.label === 'Access Permission Management';
        const isActive = item.href && currentPath === item.href.split('?')[0]
            && (currentPath !== '/role-management' || (isPermissionPage ? currentSection === 'permissions' : currentSection !== 'permissions'));

        return item.href
            ? React.createElement('a', { key: item.label, href: item.href, className: `app-sidebar__subitem${isActive ? ' active' : ''}`, 'aria-current': isActive ? 'page' : undefined }, React.createElement('i', { className: `bi ${item.icon}`, 'aria-hidden': 'true' }), React.createElement('span', null, item.label))
            : React.createElement('button', { key: item.label, type: 'button', className: 'app-sidebar__subitem', onClick: () => onNotice(item.notice) }, React.createElement('i', { className: `bi ${item.icon}`, 'aria-hidden': 'true' }), React.createElement('span', null, item.label));
    }

    function renderGroup(id, label, icon, items) {
        return React.createElement('div', { className: 'app-sidebar__group' },
            React.createElement('button', { className: 'app-sidebar__item app-sidebar__toggle', type: 'button', onClick: () => toggle(id), 'aria-expanded': openMenus[id], 'aria-controls': `technical-${id}` },
                React.createElement('i', { className: `bi ${icon}`, 'aria-hidden': 'true' }), React.createElement('span', null, label), React.createElement('i', { className: `bi bi-chevron-${openMenus[id] ? 'up' : 'down'} app-sidebar__chevron`, 'aria-hidden': 'true' })
            ),
            openMenus[id] ? React.createElement('div', { className: 'app-sidebar__submenu app-sidebar__submenu--icons', id: `technical-${id}` }, items.map(renderSubitem)) : null
        );
    }

    return React.createElement('aside', { className: 'app-sidebar', 'aria-label': 'Technical administration navigation' },
        React.createElement('a', { className: 'app-sidebar__brand', href: accessSession?.home || '/dashboard' }, React.createElement(BrandLogo, { className: 'app-sidebar__logo' }), React.createElement('span', { className: 'app-sidebar__brand-copy' }, React.createElement('strong', null, 'SPDMS'), React.createElement('small', null, 'Strategic Planning System'))),
        React.createElement('a', { className: 'app-sidebar__profile', href: '/profile' }, React.createElement('i', { className: 'bi bi-person-vcard-fill' }), React.createElement('span', null, displayRoleName(accessSession?.roleName, 'Technical Admin'))),
        React.createElement('nav', { className: 'app-sidebar__nav' },
            React.createElement('a', { className: `app-sidebar__item${currentPath === '/dashboard' ? ' active' : ''}`, href: '/dashboard' }, React.createElement('i', { className: 'bi bi-speedometer2' }), React.createElement('span', null, 'Technical Dashboard')),
            renderGroup('access', 'Access Administration', 'bi-person-lock', accessItems),
            renderGroup('security', 'Security Management', 'bi-shield-check', securityItems)
        ),
        React.createElement(LogoutButton, { className: 'app-sidebar__item app-sidebar__logout', label: 'Log Out', iconClass: 'bi bi-box-arrow-left' })
    );
}
