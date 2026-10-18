import { createPageRoot } from '../../navigation/page-root.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { loadAccessSession } from '../../access/use-access-session.js';
import { navigationFor, flattenNavigation, dashboardHrefFor } from '../../access/navigation.js';
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

// Planned-feature page (/dashboard?feature=…) for every role.
function FeaturePage({ session }) {
    const feature = new URLSearchParams(location.search).get('feature');
    const placeholder = flattenNavigation(navigationFor(session.roleName)).find(item => item.placeholder && item.id === feature);
    const title = placeholder?.label || 'Feature unavailable';
    return h(React.Fragment, null, h(AppSidebar),
        h('main', { className: 'app-shell-main dashboard-hub' }, h('div', { className: 'app-shell-container' },
            h(PageHeader, { section: title, title }),
            h(PlannedFeature, { placeholder, session }))));
}
root.render(h('p', { role: 'status' }, 'Loading your workspace…'));
loadAccessSession().then(async session => {
    if (!enforcePageAccess()) return;
    // Administrative, planner and office roles use their Dashboard; only ?feature= placeholders stay here.
    if (dashboardHrefFor(session.roleName) !== '/dashboard' && !new URLSearchParams(location.search).has('feature')) {
        location.replace(dashboardHrefFor(session.roleName));
        return;
    }
    const params = new URLSearchParams(location.search);
    if (params.get('view') === 'legacy') {
        const { LegacyDashboardApp } = await import('./legacy-dashboard.js');
        root.render(h(LegacyDashboardApp));
    } else if (params.has('feature')) {
        root.render(h(FeaturePage, { session }));
    } else {
        // Technical Admin Dashboard: technical activity on the dashboard and report masters.
        const { TechnicalDashboard } = await import('../technical-admin/technical-dashboard.js');
        root.render(h(TechnicalDashboard, { session }));
    }
}).catch(error => root.render(h('div', { role: 'alert' }, error.message, h('button', { onClick: () => location.reload() }, 'Retry'))));
