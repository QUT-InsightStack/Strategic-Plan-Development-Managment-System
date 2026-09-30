import { AppSidebar } from '../../components/AppSidebar.js';
import { apiRequest } from '../../api/api-client.js';
import { createAccessSession, saveAccessSession, can } from '../../access/access-session.js';
import { PERMISSIONS as P } from '../../access/access-policy.js';
import { enforcePageAccess } from '../../access/access-guard.js';

const h = React.createElement;
const roles = ['Management', 'Executive', 'Management / Executive'];
const groups = [
    {
        title: 'Decision and Approval',
        cards: [
            { title: 'Assigned Plan Reviews', description: 'Review assigned strategic plans, foundations, objectives and submitted materials; record an approval decision when you are the assigned reviewer.', icon: 'bi-clipboard-check', href: '/strategic-plan-reviews', permission: P.PLANS_VIEW },
            { title: 'Strategic Plans', description: 'Browse strategic plans and review plan details within your read-only access.', icon: 'bi-journal-text', href: '/strategic-plans', permission: P.PLANS_VIEW },
        ],
    },
    {
        title: 'Strategic Alignment',
        cards: [
            { title: 'Agenda and PDP Alignment', description: 'View the strategic alignment between Presidential Agenda, PDP chapters, DOST objectives and agency plans.', icon: 'bi-diagram-3', href: '/mappings?mode=view', permission: 'relations.view' },
            { title: 'Agency Input Review', description: 'Review submitted implementation inputs and their decisions across authorized plans.', icon: 'bi-building-check', href: '/consolidate-inputs', permission: P.INPUTS_VIEW },
        ],
    },
    {
        title: 'Implementation Oversight',
        cards: [
            { title: 'Objective Progress', description: 'View current objective progress, calculated status, update dates and audit history.', icon: 'bi-bar-chart-line', href: '/office?view=progress', permission: P.OBJECTIVES_VIEW_PROGRESS },
        ],
    },
];

function Dashboard({ session }) {
    const visibleGroups = groups.map(group => ({ ...group, cards: group.cards.filter(card => can(card.permission, session)) })).filter(group => group.cards.length);
    const groupSections = visibleGroups.map(group => {
        const cards = group.cards.map(card => h('article', { className: 'ui-card management-dashboard__card', key: card.title },
            h('div', { className: 'management-dashboard__card-heading' },
                h('span', { className: 'management-dashboard__icon', 'aria-hidden': 'true' }, h('i', { className: `bi ${card.icon}` })),
                h('h3', null, card.title)),
            h('p', null, card.description),
            h('a', { className: 'ui-button ui-button--primary ui-button--sm', href: card.href }, 'Open')));
        return h('section', { className: 'management-dashboard__group', key: group.title },
            h('h2', null, group.title),
            h('div', { className: 'management-dashboard__grid' }, cards));
    });

    return h('div', { className: 'app-shell management-dashboard' },
        h(AppSidebar),
        h('main', { className: 'app-shell-main' },
            h('div', { className: 'management-dashboard__content' },
                h('header', { className: 'management-dashboard__header' },
                    h('div', null,
                        h('p', { className: 'management-dashboard__eyebrow' }, 'Management / Executive'),
                        h('h1', null, 'Management Dashboard'),
                        h('p', null, `Welcome, ${session.name || 'Management'}. Open the planning and oversight functions available to your role.`)),
                visibleGroups.length
                    ? groupSections
                    : h('p', { className: 'management-dashboard__empty', role: 'status' }, 'No Management functions are currently enabled for this account. Contact your Technical Administrator to review its role permissions.')))));
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading Management access…'));
apiRequest('/api/auth/me').then(payload => {
    const session = saveAccessSession(createAccessSession(payload.data));
    if (!roles.includes(session.roleName)) { window.location.replace('/access-denied'); return; }
    if (enforcePageAccess()) root.render(h(Dashboard, { session }));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
