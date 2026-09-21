import { BrandLogo } from '../brand-logo.js';
import { can, getAccessSession } from '../access/access-session.js';
import { PERMISSIONS as P } from '../access/access-policy.js';
import { adminRoleKind, displayRoleName } from '../access/role-labels.js';
import { TechnicalAdminSidebar } from './TechnicalAdminSidebar.js';
import { LogoutButton } from './LogoutButton.js';

const { useState } = React;

export function AdministrativeAdminSidebar({ active = 'Reference Data', onNotice = () => {} }) {
    const currentPath = window.location.pathname;
    const accessSession = getAccessSession();
    const [openMenus, setOpenMenus] = useState({ planning: true, monitoring: true });

    if (adminRoleKind(accessSession?.roleName) === 'technical' || accessSession?.roleName === 'Administrator') {
        return React.createElement(TechnicalAdminSidebar, { onNotice });
    }
    const itemPermissions = {
        'Presidential Agenda': P.REFERENCE_DATA_MANAGE,
        'PDP Chapters': P.PDP_CHAPTERS_MANAGE,
        'Reference Data': P.REFERENCE_DATA_MANAGE,
        'Templates': P.TEMPLATES_MANAGE,
        'Monitoring Dashboard': P.MONITORING_VIEW,
        'Reports': P.REPORTS_VIEW,
        'System Logs': P.LOGS_VIEW,
    };

    function toggle(menu) {
        setOpenMenus((current) => ({ ...current, [menu]: !current[menu] }));
    }

    function subitem(label, href, icon) {
        if (!can(itemPermissions[label], accessSession)) return null;
        const isActive = active === label;
        return React.createElement('a', { key: label, className: `app-sidebar__subitem${isActive ? ' active' : ''}`, href, 'aria-current': isActive ? 'page' : undefined }, React.createElement('i', { className: `bi ${icon}`, 'aria-hidden': 'true' }), React.createElement('span', null, label));
    }

    function noticeItem(label, icon, message) {
        if (!can(itemPermissions[label], accessSession)) return null;
        const isActive = active === label;
        return React.createElement('button', { key: label, className: `app-sidebar__subitem${isActive ? ' active' : ''}`, type: 'button', onClick: () => onNotice(message) }, React.createElement('i', { className: `bi ${icon}`, 'aria-hidden': 'true' }), React.createElement('span', null, label));
    }

    return React.createElement('aside', { className: 'app-sidebar', 'aria-label': 'Administrative navigation' },
        React.createElement('a', { className: 'app-sidebar__brand', href: accessSession?.home || '/dashboard' }, React.createElement(BrandLogo, { className: 'app-sidebar__logo' }), React.createElement('span', { className: 'app-sidebar__brand-copy' }, React.createElement('strong', null, 'SPDMS'), React.createElement('small', null, 'Strategic Planning System'))),
        React.createElement('a', { className: 'app-sidebar__profile', href: '/profile', 'aria-label': 'Open user profile' }, React.createElement('i', { className: 'bi bi-person-vcard-fill', 'aria-hidden': 'true' }), React.createElement('span', null, displayRoleName(accessSession?.roleName, 'User'))),
        React.createElement('nav', { className: 'app-sidebar__nav' },
            React.createElement('a', { className: `app-sidebar__item${currentPath === '/dashboard' ? ' active' : ''}`, href: '/dashboard' }, React.createElement('i', { className: 'bi bi-speedometer2' }), React.createElement('span', null, 'Administrative Dashboard')),
            [P.REFERENCE_DATA_MANAGE, P.PDP_CHAPTERS_MANAGE, P.TEMPLATES_MANAGE].some(permission => can(permission, accessSession)) && React.createElement('div', { className: 'app-sidebar__group' },
                React.createElement('button', { className: 'app-sidebar__item app-sidebar__toggle', type: 'button', onClick: () => toggle('planning'), 'aria-expanded': openMenus.planning, 'aria-controls': 'administrative-planning' }, React.createElement('i', { className: 'bi bi-clipboard2-check-fill' }), React.createElement('span', null, 'Planning Preparation'), React.createElement('i', { className: `bi bi-chevron-${openMenus.planning ? 'up' : 'down'} app-sidebar__chevron`, 'aria-hidden': 'true' })),
                openMenus.planning ? React.createElement('div', { className: 'app-sidebar__submenu app-sidebar__submenu--icons', id: 'administrative-planning' },
                    subitem('Presidential Agenda', '/administrative-admin/reference-data?tab=agenda', 'bi-bank2'),
                    subitem('PDP Chapters', '/pdp-chapters/manage', 'bi-journal-text'),
                    subitem('Reference Data', '/administrative-admin/reference-data', 'bi-database-fill-gear'),
                    subitem('Templates', '/administrative-admin/templates', 'bi-file-earmark-text-fill')
                ) : null
            ),
            [P.MONITORING_VIEW, P.REPORTS_VIEW, P.LOGS_VIEW].some(permission => can(permission, accessSession)) && React.createElement('div', { className: 'app-sidebar__group' },
                React.createElement('button', { className: 'app-sidebar__item app-sidebar__toggle', type: 'button', onClick: () => toggle('monitoring'), 'aria-expanded': openMenus.monitoring, 'aria-controls': 'administrative-monitoring' }, React.createElement('i', { className: 'bi bi-graph-up-arrow' }), React.createElement('span', null, 'Administrative Monitoring'), React.createElement('i', { className: `bi bi-chevron-${openMenus.monitoring ? 'up' : 'down'} app-sidebar__chevron`, 'aria-hidden': 'true' })),
                openMenus.monitoring ? React.createElement('div', { className: 'app-sidebar__submenu app-sidebar__submenu--icons', id: 'administrative-monitoring' },
                    noticeItem('Monitoring Dashboard', 'bi-bar-chart-line-fill', 'Monitoring Dashboard is reserved for its implementation page.'),
                    noticeItem('Reports', 'bi-file-earmark-bar-graph-fill', 'Reports is reserved for its implementation page.'),
                    can(P.LOGIN_HISTORY_VIEW, accessSession) ? subitem('System Logs', '/login-history', 'bi-list-check') : null
                ) : null
            )
        ),
        React.createElement(LogoutButton, { className: 'app-sidebar__item app-sidebar__logout', label: 'Log Out', iconClass: 'bi bi-box-arrow-left' })
    );
}
