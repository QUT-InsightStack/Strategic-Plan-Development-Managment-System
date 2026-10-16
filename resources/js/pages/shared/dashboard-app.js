import { createPageRoot } from '../../navigation/page-root.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { loadAccessSession } from '../../access/use-access-session.js';
import { navigationFor, navigationRole, dashboardLabels, flattenNavigation, canOpenPage, dashboardHrefFor } from '../../access/navigation.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import '../../../css/dashboard-hub.css';
const h = React.createElement;
const root = createPageRoot(document.getElementById('root'));

// A planned feature (?feature=…) or a feature outside this role's workspace.
function PlannedFeature({ placeholder, session }) {
    return h('section', { className: 'ui-card dashboard-hub__notice', 'aria-labelledby': 'planned-feature-title' },
        h('span', { className: 'dashboard-hub__notice-icon' }, h('i', { className: `bi ${placeholder?.icon || 'bi-hourglass-split'}`, 'aria-hidden': true })),
        h('div', null,
            h('span', { className: 'ui-badge ui-badge--info' }, placeholder ? 'Planned feature' : 'Feature unavailable'),
            h('h2', { id: 'planned-feature-title' }, placeholder ? `${placeholder.label} is not available yet` : 'This feature is not part of your workspace'),
            h('p', null, placeholder ? 'This feature has not been implemented yet. No records or reports are generated on this page.' : 'This feature is not part of your current role workspace.'),
            h('div', { className: 'dashboard-hub__notice-actions' },
                h('a', { className: 'ui-button ui-button--primary ui-button--sm', href: dashboardHrefFor(session.roleName) }, h('i', { className: 'bi bi-arrow-left', 'aria-hidden': true }), 'Back to dashboard'),
                h('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: '/how-spdms-works' }, h('i', { className: 'bi bi-signpost-split', 'aria-hidden': true }), 'How SPDMS Works'))));
}

function FunctionCard({ item, session }) {
    const allowed = canOpenPage(item, session);
    const description = !allowed ? 'Your account does not have access to this function.' : item.placeholder ? 'Planned — not implemented yet.'
        : item.description || (item.source === 'local' ? 'Local demonstration. Mapping changes are stored in this browser.' : 'Open this function.');
    return h('article', { className: `ui-card dashboard-hub__card${allowed ? '' : ' is-locked'}` },
        h('span', { className: 'dashboard-hub__card-icon' }, h('i', { className: `bi ${allowed ? item.icon || 'bi-grid' : 'bi-lock'}`, 'aria-hidden': true })),
        h('div', { className: 'dashboard-hub__card-copy' }, h('h3', null, item.label), h('p', null, description)),
        allowed ? h('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: item.href, 'aria-label': `${item.placeholder ? 'View status of' : 'Open'} ${item.label}` },
            item.placeholder ? 'View status' : 'Open', h('i', { className: 'bi bi-arrow-right', 'aria-hidden': true })) : null);
}

function Dashboard({ session }) {
    const entries = navigationFor(session.roleName);
    const feature = new URLSearchParams(location.search).get('feature');
    const placeholder = flattenNavigation(entries).find(item => item.placeholder && item.id === feature);
    const title = feature ? placeholder?.label || 'Feature unavailable' : dashboardLabels[navigationRole(session.roleName)];
    return h(React.Fragment, null, h(AppSidebar),
        h('main', { className: 'app-shell-main dashboard-hub' }, h('div', { className: 'app-shell-container' },
            h(PageHeader, { section: title, title,
                subtitle: feature ? null : 'Choose a function below. Access is based on the permissions currently assigned to your account.' }),
            feature ? h(PlannedFeature, { placeholder, session })
                : h(React.Fragment, null,
                    entries.filter(item => item.children).map(section => h('section', { key: section.id, className: 'dashboard-hub__section', 'aria-labelledby': `hub-${section.id}` },
                        h('h2', { id: `hub-${section.id}` }, h('i', { className: `bi ${section.icon}`, 'aria-hidden': true }), section.label),
                        h('div', { className: 'dashboard-hub__grid' }, section.children.filter(item => !item.hideWhenDenied || canOpenPage(item, session))
                            .map(item => h(FunctionCard, { key: item.id, item, session }))))),
                    h('details', { className: 'ui-card dashboard-hub__legacy' }, h('summary', null, 'Existing tools / compatibility'),
                        h('p', null, 'The previous dashboard and its generic resource tools remain available. Use the main workspace for regular work.'),
                        h('a', { href: '/dashboard?view=legacy' }, 'Open previous dashboard'))))));
}
root.render(h('p', { role: 'status' }, 'Loading your workspace…'));
loadAccessSession().then(async session => {
    if (!enforcePageAccess()) return;
    // Administrative, planner and office roles use their Dashboard; only ?feature= placeholders stay here.
    if (dashboardHrefFor(session.roleName) !== '/dashboard' && !new URLSearchParams(location.search).has('feature')) {
        location.replace(dashboardHrefFor(session.roleName));
        return;
    }
    if (new URLSearchParams(location.search).get('view') === 'legacy') {
        const { LegacyDashboardApp } = await import('./legacy-dashboard.js');
        root.render(h(LegacyDashboardApp));
    } else root.render(h(Dashboard, { session }));
}).catch(error => root.render(h('div', { role: 'alert' }, error.message, h('button', { onClick: () => location.reload() }, 'Retry'))));
