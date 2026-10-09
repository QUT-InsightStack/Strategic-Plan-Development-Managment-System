import { BrandLogo } from '../brand-logo.js';
import { LogoutButton } from './LogoutButton.js';
import { displayRoleName } from '../access/role-labels.js';
import { useAccessSession } from '../access/use-access-session.js';
import { navigationFor, navigationRole, canOpenPage, isCurrentPage } from '../access/navigation.js';
import { canDeleteMappings } from '../mappings/mapping-eligibility.js';
import '../../css/navigation.css';

export function AppSidebar() {
    const { session, error, retry } = useAccessSession();
    const [open, setOpen] = React.useState({});
    const h = React.createElement;
    const items = session ? navigationFor(session.roleName) : [];
    const href = window.location.href;
    // Technical Administrators can permanently delete strategic alignment
    // mappings (SPDM-42); this link is their way to the page.
    const showAlignmentMappings = Boolean(session) && navigationRole(session.roleName) === 'technical' && !['Administrator', 'test'].includes(session.roleName) && canDeleteMappings(session);
    const onMappingsPage = window.location.pathname === '/mappings';
    function leaf(item, nested = false) {
        const allowed = canOpenPage(item, session);
        if (!allowed && item.hideWhenDenied) return null;
        const current = isCurrentPage(item, href);
        const className = `${nested ? 'app-sidebar__subitem' : 'app-sidebar__item'}${current ? ' active' : ''}`;
        const content = [!nested && item.icon ? h('i', { key: 'icon', className: `bi ${item.icon}`, 'aria-hidden': true }) : null,
            h('span', { key: 'label' }, item.label), item.placeholder && h('small', { key: 'state' }, 'Planned')];
        return allowed ? h('a', { key: item.id, href: item.href, className, 'aria-current': current ? 'page' : undefined }, ...content)
            : h('span', { key: item.id, className: className + ' navigation-locked', 'aria-disabled': true, title: 'Your account does not have the permissions required to open this page.' }, ...content, h('small', null, 'No access'));
    }
    return h('aside', { className: 'app-sidebar', 'aria-label': 'Primary navigation' },
        h('a', { className: 'app-sidebar__brand', href: items[0]?.href || '/dashboard' }, h(BrandLogo, { className: 'app-sidebar__logo' }), h('span', { className: 'app-sidebar__brand-copy' }, h('strong', null, 'SPDMS'), h('small', null, 'Strategic Planning System'))),
        h('a', { className: 'app-sidebar__profile', href: '/profile' }, h('i', { className: 'bi bi-person-vcard-fill', 'aria-hidden': true }), h('span', null, displayRoleName(session?.roleName, 'Loading account…'))),
        h('nav', { className: 'app-sidebar__nav' },
            !session && h('p', { role: error ? 'alert' : 'status' }, error || 'Loading menu…'),
            error && h('button', { type: 'button', onClick: retry }, 'Retry'),
            items.map(item => {
                if (!item.children) return leaf(item);
                const children = item.children.filter(child => !child.dashboardOnly && (!child.hideWhenDenied || canOpenPage(child, session)));
                if (!children.length) return null;
                const expanded = open[item.id] ?? true;
                const current = children.some(child => isCurrentPage(child, href));
                return h('div', { key: item.id, className: 'app-sidebar__group' },
                    h('button', { type: 'button', className: `app-sidebar__item app-sidebar__toggle${current ? ' active' : ''}`, 'aria-expanded': expanded, 'aria-controls': `nav-${item.id}`, onClick: () => setOpen(value => ({ ...value, [item.id]: !expanded })) },
                        h('i', { className: `bi ${item.icon}`, 'aria-hidden': true }), h('span', null, item.label), h('i', { className: `bi bi-chevron-${expanded ? 'up' : 'down'} app-sidebar__chevron`, 'aria-hidden': true })),
                    expanded && h('div', { id: `nav-${item.id}`, className: 'app-sidebar__submenu' }, children.map(child => leaf(child, true))));
            }),
            showAlignmentMappings && h('a', { key: 'alignment-mappings', href: '/mappings', className: `app-sidebar__item${onMappingsPage ? ' active' : ''}`, 'aria-current': onMappingsPage ? 'page' : undefined }, h('span', null, 'Alignment Mappings'))),
        h(LogoutButton, { className: 'app-sidebar__item app-sidebar__logout', label: 'Log Out', iconClass: 'bi bi-box-arrow-left' }));
}
