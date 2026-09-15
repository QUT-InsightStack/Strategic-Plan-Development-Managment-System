import { BrandLogo } from '../brand-logo.js';
import { PERMISSIONS } from '../access/access-policy.js';
import { can, getAccessSession } from '../access/access-session.js';
import { adminRoleKind, displayRoleName } from '../access/role-labels.js';
import { AdministrativeAdminSidebar } from './AdministrativeAdminSidebar.js';
import { LogoutButton } from './LogoutButton.js';

const { useState } = React;

const accessItems = [
    { label: 'User Account Management', icon: 'bi-people-fill', href: '/user-management', permission: PERMISSIONS.USERS_VIEW },
    { label: 'Role Management', icon: 'bi-person-gear', href: '/role-management', permission: PERMISSIONS.ROLES_MANAGE },
    { label: 'Access Permission Management', icon: 'bi-shield-lock-fill', href: '/role-management?section=permissions', permission: PERMISSIONS.PERMISSIONS_MANAGE },
    { label: 'Settings', icon: 'bi-gear-fill', href: '/role-management?section=security', permission: PERMISSIONS.SETTINGS_MANAGE },
    {
    label: 'Workflow Configuration',
    icon: 'bi-diagram-3-fill',
    href: '/workflow-configuration',
    permission: PERMISSIONS.SETTINGS_MANAGE,
},
];
const planningItems = [
    {
        label: 'Manage Plans',
        icon: 'bi-clipboard-data',
        href: '/strategic-plans',
        permission: PERMISSIONS.PLANS_VIEW,
    },
    {
        label: 'Strategic Objectives',
        icon: 'bi-bullseye',
        href: '/strategic-objectives',
        permission: PERMISSIONS.PLANS_VIEW,
    },
];

const administrativeItems = [
    { label: 'Presidential Agenda', icon: 'bi-bank2', href: '/administrative-admin/reference-data?tab=agenda', permission: PERMISSIONS.REFERENCE_DATA_MANAGE },
    { label: 'PDP Chapters', icon: 'bi-journal-text', href: '/pdp-chapters/manage', permission: PERMISSIONS.PDP_CHAPTERS_MANAGE },
    { label: 'Reference Data', icon: 'bi-database-fill-gear', href: '/administrative-admin/reference-data', permission: PERMISSIONS.REFERENCE_DATA_MANAGE },
    { label: 'Templates', icon: 'bi-file-earmark-text-fill', href: '/administrative-admin/templates', permission: PERMISSIONS.TEMPLATES_MANAGE },
];

const monitoringItems = [
    { label: 'Monitoring Dashboard', icon: 'bi-bar-chart-line-fill', notice: 'Monitoring Dashboard is reserved for its implementation page.', permission: PERMISSIONS.MONITORING_VIEW },
    { label: 'Reports', icon: 'bi-file-earmark-bar-graph-fill', notice: 'Reports is reserved for its implementation page.', permission: PERMISSIONS.REPORTS_VIEW },
    { label: 'System Logs', icon: 'bi-list-check', href: '/login-history', permission: PERMISSIONS.LOGS_VIEW },
];

const securityItems = [
    { label: 'Login History', icon: 'bi-clock-history', href: '/login-history', permission: PERMISSIONS.LOGS_VIEW },
    { label: 'Security Logs', icon: 'bi-shield-exclamation', notice: 'Security Logs is reserved for its implementation page.', permission: PERMISSIONS.LOGS_VIEW },
    { label: 'Audit Logs', icon: 'bi-journal-check', notice: 'Audit Logs is reserved for its implementation page.', permission: PERMISSIONS.LOGS_VIEW },
    { label: 'System Maintenance', icon: 'bi-tools', href: '/manual-backup', permission: PERMISSIONS.BACKUPS_VIEW },
];

export function TechnicalAdminSidebar({ onNotice = () => {} }) {
    const currentPath = window.location.pathname;
    const currentSection = new URLSearchParams(
        window.location.search
    ).get('section');
    const accessSession = getAccessSession();

    const [openMenus, setOpenMenus] = useState({
        planning: true,
        administrative: true,
        monitoring: true,
        access: true,
        security: true,
    });

    if (adminRoleKind(accessSession?.roleName) === 'administrative') {
        return React.createElement(AdministrativeAdminSidebar, { onNotice });
    }

    const hasPlanningAccess = accessSession?.roleName === 'Administrator' && planningItems.some(
        (item) =>
            !item.permission ||
            can(item.permission, accessSession)
    );
    const isFullAdministrator = accessSession?.roleName === 'Administrator';

    function toggle(menu) {
        setOpenMenus((current) => ({
            ...current,
            [menu]: !current[menu],
        }));
    }

    function renderSubitem(item) {
        if (item.permission && !can(item.permission, accessSession)) return null;
        const isPermissionPage = item.label === 'Access Permission Management';
        const isSettingsPage = item.label === 'Settings';
        const isActive = item.href && currentPath === item.href.split('?')[0]
            && (currentPath !== '/role-management' || (isPermissionPage ? currentSection === 'permissions' : isSettingsPage ? currentSection === 'security' : currentSection !== 'permissions' && currentSection !== 'security'));

        return item.href
            ? React.createElement('a', { key: item.label, href: item.href, className: `app-sidebar__subitem${isActive ? ' active' : ''}`, 'aria-current': isActive ? 'page' : undefined }, React.createElement('i', { className: `bi ${item.icon}`, 'aria-hidden': 'true' }), React.createElement('span', null, item.label))
            : React.createElement('button', { key: item.label, type: 'button', className: 'app-sidebar__subitem', onClick: () => onNotice(item.notice) }, React.createElement('i', { className: `bi ${item.icon}`, 'aria-hidden': 'true' }), React.createElement('span', null, item.label));
    }

    function renderGroup(id, label, icon, items) {
        if (!items.some(item => !item.permission || can(item.permission, accessSession))) return null;
        return React.createElement('div', { className: 'app-sidebar__group' },
            React.createElement('button', { className: 'app-sidebar__item app-sidebar__toggle', type: 'button', onClick: () => toggle(id), 'aria-expanded': openMenus[id], 'aria-controls': `technical-${id}` },
                React.createElement('i', { className: `bi ${icon}`, 'aria-hidden': 'true' }), React.createElement('span', null, label), React.createElement('i', { className: `bi bi-chevron-${openMenus[id] ? 'up' : 'down'} app-sidebar__chevron`, 'aria-hidden': 'true' })
            ),
            openMenus[id] ? React.createElement('div', { className: 'app-sidebar__submenu app-sidebar__submenu--icons', id: `technical-${id}` }, items.map(renderSubitem)) : null
        );
    }

    return React.createElement('aside', { className: 'app-sidebar', 'aria-label': 'Technical administration navigation' },
        React.createElement('a', { className: 'app-sidebar__brand', href: accessSession?.home || '/dashboard' }, React.createElement(BrandLogo, { className: 'app-sidebar__logo' }), React.createElement('span', { className: 'app-sidebar__brand-copy' }, React.createElement('strong', null, 'SPDMS'), React.createElement('small', null, 'Strategic Planning System'))),
        React.createElement('a', { className: 'app-sidebar__profile', href: '/profile' }, React.createElement('i', { className: 'bi bi-person-vcard-fill' }), React.createElement('span', null, displayRoleName(accessSession?.roleName, 'User'))),
        React.createElement('nav', { className: 'app-sidebar__nav' },
            React.createElement('a', { className: `app-sidebar__item${currentPath === '/dashboard' ? ' active' : ''}`, href: '/dashboard' }, React.createElement('i', { className: 'bi bi-speedometer2' }), React.createElement('span', null, 'Technical Dashboard')),
            hasPlanningAccess
    ? renderGroup(
        'planning',
        'Planning Module',
        'bi-clipboard2-check',
        planningItems
    )
    : null,
            isFullAdministrator ? renderGroup('administrative', 'Planning Preparation', 'bi-clipboard2-check-fill', administrativeItems) : null,
            isFullAdministrator ? renderGroup('monitoring', 'Administrative Monitoring', 'bi-graph-up-arrow', monitoringItems) : null,
            renderGroup('access', 'Access Administration', 'bi-person-lock', accessItems),
            renderGroup('security', 'Security Management', 'bi-shield-check', securityItems)
        ),
        React.createElement(LogoutButton, { className: 'app-sidebar__item app-sidebar__logout', label: 'Log Out', iconClass: 'bi bi-box-arrow-left' })
    );
}
