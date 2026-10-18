import { getAccessSession } from '../access/access-session.js';
import { breadcrumbFor, canOpenPage } from '../access/navigation.js';
import '../../css/components/page-header.css';

const h = (...args) => React.createElement(...args);

// Breadcrumb trail in sidebar order: Dashboard › group › page, then any `trail` crumbs for pages
// below a sidebar entry (for example a plan's objectives). `section` is the fallback for pages that
// are not in the role's sidebar.
export function pageCrumbs({ section, trail = [], href = window.location.href, session = getAccessSession() } = {}) {
    const found = breadcrumbFor(href, session?.roleName);
    const crumbs = [found.dashboard];
    if (found.page && found.page.href !== found.dashboard.href) {
        if (found.group) crumbs.push({ label: found.group.label });
        crumbs.push({ label: found.page.label, href: found.page.href });
    } else if (!found.page && section && section !== 'Dashboard') {
        crumbs.push({ label: section });
    }
    trail.forEach(item => crumbs.push(typeof item === 'string' ? { label: item } : item));
    // The last crumb is the current page and is not a link.
    crumbs[crumbs.length - 1] = { label: crumbs[crumbs.length - 1].label, current: true };
    return { crumbs, step: found.step };
}

export function Breadcrumb({ section, trail, className = '' }) {
    const session = getAccessSession();
    const { crumbs, step } = pageCrumbs({ section, trail, session });
    const stepLink = (item, direction) => item && canOpenPage(item, session)
        ? h('a', { className: `ui-step__link ui-step__link--${direction}`, href: item.href, title: `${direction === 'previous' ? 'Previous' : 'Next'} step: ${item.label}` },
            direction === 'previous' ? h('i', { className: 'bi bi-arrow-left', 'aria-hidden': 'true' }) : null,
            h('span', null, item.label),
            direction === 'next' ? h('i', { className: 'bi bi-arrow-right', 'aria-hidden': 'true' }) : null)
        : null;
    return h('div', { className: `ui-breadcrumb-bar ${className}`.trim() },
        h('nav', { className: 'ui-breadcrumb', 'aria-label': 'Breadcrumb' },
            h('ol', null, crumbs.map((crumb, index) => h('li', { key: `${crumb.label}-${index}` },
                index ? h('i', { className: 'bi bi-chevron-right', 'aria-hidden': 'true' }) : h('i', { className: 'bi bi-house-door', 'aria-hidden': 'true' }),
                crumb.current ? h('span', { 'aria-current': 'page' }, crumb.label)
                    : crumb.href ? h('a', { href: crumb.href }, crumb.label) : h('span', null, crumb.label))))),
        step ? h('nav', { className: 'ui-step', 'aria-label': 'Planning steps' },
            stepLink(step.previous, 'previous'),
            h('span', { className: 'ui-step__count' }, `Step ${step.number} of ${step.total}`),
            stepLink(step.next, 'next')) : null);
}

export function PageHeader({ section, title, subtitle, actions = null, className = '', trail = [] }) {
    return h('header', { className: `app-page-header ${className}`.trim() },
        h('div', { className: 'app-page-header__copy' },
            h(Breadcrumb, { section, trail }),
            h('h1', { className: 'ui-page-title' }, title),
            subtitle ? h('p', { className: 'ui-page-subtitle' }, subtitle) : null),
        actions ? h('div', { className: 'app-page-header__actions' }, actions) : null);
}
