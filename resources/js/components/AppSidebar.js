import { BrandLogo } from '../brand-logo.js';
import { PERMISSIONS } from '../access/access-policy.js';
import { can, clearAccessSession, getAccessSession } from '../access/access-session.js';
import { displayRoleName } from '../access/role-labels.js';
import { LogoutButton } from './LogoutButton.js';

const { useState } = React;

const items = [
    { label: 'Home', icon: 'bi-house-door-fill', href: '/dashboard', permission: PERMISSIONS.DASHBOARD_VIEW },
    {
        label: 'Planning Module',
        icon: 'bi-clipboard2-check',
        permission: PERMISSIONS.PLANS_VIEW,
        children: [
            { label: 'Consolidate Inputs' },
            { label: 'Create Plans', href: '/strategic-plans/create', permission: PERMISSIONS.PLANS_CREATE },
            { label: 'Manage Plans', href: '/strategic-plans', permission: PERMISSIONS.PLANS_VIEW },
            { label: 'Strategic Objectives', href: '/strategic-objectives', permission: PERMISSIONS.PLANS_VIEW },
            { label: 'PDP Chapters', href: '/pdp-chapters' },
            { label: 'Monitor Plans' },
            { label: 'Finalize Plans' },
        ],
    },
    {
        label: 'Mapping Module',
        icon: 'bi-map',
        permission: PERMISSIONS.MAPPINGS_MANAGE,
        children: [
            { label: 'Create Mapping', permission: PERMISSIONS.PLANS_CREATE },
            { label: 'Review Mappings', permission: PERMISSIONS.PLANS_VIEW },
            { label: 'Update Mapping', permission: PERMISSIONS.PLANS_UPDATE },
            { label: 'Archive Mapping', permission: PERMISSIONS.PLANS_ARCHIVE },
            { label: 'Delete Mapping', permission: PERMISSIONS.PLANS_DELETE },
        ],
    },
    { label: 'FAQ', icon: 'bi-info-square-fill' },
    { label: 'Report', icon: 'bi-file-earmark-bar-graph', permission: PERMISSIONS.REPORTS_VIEW },
];

export function AppSidebar({ active = 'Planning Module', onNotice = () => {} }) {
    const currentPath = window.location.pathname;
    const accessSession = getAccessSession();
    const [openMenus, setOpenMenus] = useState({
        'Planning Module': currentPath.startsWith('/strategic-plan') || currentPath.startsWith('/strategic-objectives') || currentPath.startsWith('/pdp-chapters'),
        'Mapping Module': false,
    });

    function toggleMenu(label) {
        setOpenMenus((current) => ({ ...current, [label]: !current[label] }));
    }

    function renderChild(parent, child) {
        if (child.permission && !can(child.permission, accessSession)) return null;
        if (child.children) {
            const visibleChildren = child.children.filter((nested) => !nested.permission || can(nested.permission, accessSession));
            const expanded = Boolean(openMenus[child.label]);
            const menuId = `sidebar-${child.label.toLowerCase().replaceAll(' ', '-')}`;

            return React.createElement('div', { className: 'app-sidebar__nested-group', key: child.label },
                React.createElement('button', {
                    className: 'app-sidebar__subitem app-sidebar__nested-toggle',
                    type: 'button',
                    onClick: () => toggleMenu(child.label),
                    'aria-expanded': expanded,
                    'aria-controls': menuId,
                },
                React.createElement('span', null, child.label),
                React.createElement('i', { className: `bi bi-chevron-${expanded ? 'up' : 'down'}`, 'aria-hidden': 'true' })),
                expanded ? React.createElement('div', { className: 'app-sidebar__nested-menu', id: menuId }, visibleChildren.map((nested) => renderChild(child, nested))) : null
            );
        }
        const isCurrent = child.href === currentPath ||
            (child.href === '/strategic-plans' && currentPath.startsWith('/strategic-plans/') && currentPath !== '/strategic-plans/create') ||
            (child.href === '/pdp-chapters' && currentPath.startsWith('/pdp-chapters/') && !currentPath.startsWith('/pdp-chapters/manage'));
        const className = `app-sidebar__subitem${isCurrent ? ' active' : ''}`;

        return child.href
            ? React.createElement('a', { key: child.label, className, href: child.href, 'aria-current': isCurrent ? 'page' : undefined }, child.label)
            : React.createElement('button', { key: child.label, className, type: 'button', onClick: () => onNotice(`${child.label} is reserved for a later module.`) }, child.label);
    }

    function renderItem(item) {
        if (item.permission && !can(item.permission, accessSession)) return null;
        if (item.children) {
            const expanded = Boolean(openMenus[item.label]);
            const menuId = `sidebar-${item.label.toLowerCase().replaceAll(' ', '-')}`;

            return React.createElement('div', { className: 'app-sidebar__group', key: item.label },
                React.createElement('button', {
                    type: 'button',
                    className: `app-sidebar__item app-sidebar__toggle${active === item.label ? ' active' : ''}`,
                    onClick: () => toggleMenu(item.label),
                    'aria-expanded': expanded,
                    'aria-controls': menuId,
                },
                React.createElement('i', { className: `bi ${item.icon}` }),
                React.createElement('span', null, item.label),
                React.createElement('i', { className: `bi bi-chevron-${expanded ? 'up' : 'down'} app-sidebar__chevron`, 'aria-hidden': 'true' })
                ),
                expanded ? React.createElement('div', { className: 'app-sidebar__submenu', id: menuId }, item.children.map((child) => renderChild(item, child))) : null
            );
        }

        return item.href
            ? React.createElement('a', { key: item.label, href: item.href, className: `app-sidebar__item${item.href === currentPath ? ' active' : ''}`, 'aria-current': item.href === currentPath ? 'page' : undefined }, React.createElement('i', { className: `bi ${item.icon}` }), React.createElement('span', null, item.label))
            : React.createElement('button', { key: item.label, type: 'button', className: `app-sidebar__item${active === item.label ? ' active' : ''}`, onClick: () => onNotice(`${item.label} is reserved for a later module.`) }, React.createElement('i', { className: `bi ${item.icon}` }), React.createElement('span', null, item.label));
    }

    return React.createElement('aside', { className: 'app-sidebar', 'aria-label': 'Primary navigation' },
        React.createElement('a', { className: 'app-sidebar__brand', href: accessSession?.home || '/login' },
            React.createElement(BrandLogo, { className: 'app-sidebar__logo' }),
            React.createElement('span', { className: 'app-sidebar__brand-copy' }, React.createElement('strong', null, 'SPDMS'), React.createElement('small', null, 'Strategic Planning System'))
        ),
        React.createElement('a', { className: 'app-sidebar__profile', href: '/profile', 'aria-label': 'Open user profile' }, React.createElement('i', { className: 'bi bi-person-vcard-fill' }), React.createElement('span', null, displayRoleName(accessSession?.roleName, 'User'))),
        React.createElement('nav', { className: 'app-sidebar__nav' }, items.map(renderItem)),
        React.createElement(LogoutButton, { className: 'app-sidebar__item app-sidebar__logout', label: 'Log Out', iconClass: 'bi bi-box-arrow-left' })
    );
}
