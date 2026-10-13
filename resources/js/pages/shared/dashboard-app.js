import { createPageRoot } from '../../navigation/page-root.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { loadAccessSession } from '../../access/use-access-session.js';
import { navigationFor, navigationRole, dashboardLabels, flattenNavigation, canOpenPage } from '../../access/navigation.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import '../../../css/office.css';
const h = React.createElement;
const root = createPageRoot(document.getElementById('root'));
function Dashboard({ session }) {
    const entries = navigationFor(session.roleName);
    const feature = new URLSearchParams(location.search).get('feature');
    const placeholder = flattenNavigation(entries).find(item => item.placeholder && item.id === feature);
    return h('div', { className: 'office-workspace' }, h(AppSidebar), h('main', { className: 'office-content' }, h('div', { className: 'module-hub' },
        h('h1', null, placeholder?.label || dashboardLabels[navigationRole(session.roleName)]),
        feature ? h('section', { className: 'module-hub__card' }, h('h2', null, placeholder ? 'Planned feature' : 'Feature unavailable'),
            h('p', null, placeholder ? 'This feature has not been implemented yet. No records or reports are generated on this page.' : 'This feature is not part of your current role workspace.'),
            h('a', { className: 'ui-button ui-button--secondary', href: '/dashboard' }, 'Back to dashboard'))
        : h(React.Fragment, null, h('p', null, 'Choose a function below. Access is based on the permissions currently assigned to your account.'),
            entries.filter(item => item.children).map(section => h('section', { key: section.id }, h('h2', null, section.label),
                h('div', { className: 'module-hub__grid' }, section.children.filter(item => !item.hideWhenDenied || canOpenPage(item, session)).map(item => {
                    const allowed = canOpenPage(item, session);
                    return h('article', { key: item.id, className: 'module-hub__card' }, h('h3', null, item.label),
                        h('p', null, !allowed ? 'Your account does not have access to this function.' : item.placeholder ? 'Planned — not implemented yet.' : item.description || (item.source === 'local' ? 'Local demonstration. Mapping changes are stored in this browser.' : 'Open this function.')),
                        allowed && h('a', { className: 'ui-button ui-button--secondary', href: item.href }, item.placeholder ? 'View status' : 'Open'));
                })))),
            h('details', { className: 'module-hub__card' }, h('summary', null, 'Existing tools / compatibility'), h('p', null, 'The previous dashboard and its generic resource tools remain available. Use the main workspace for regular work.'), h('a', { href: '/dashboard?view=legacy' }, 'Open previous dashboard'))))));
}
root.render(h('p', { role: 'status' }, 'Loading your workspace…'));
loadAccessSession().then(async session => {
    if (!enforcePageAccess()) return;
    if (new URLSearchParams(location.search).get('view') === 'legacy') {
        const { LegacyDashboardApp } = await import('./legacy-dashboard.js');
        root.render(h(LegacyDashboardApp));
    } else root.render(h(Dashboard, { session }));
}).catch(error => root.render(h('div', { role: 'alert' }, error.message, h('button', { onClick: () => location.reload() }, 'Retry'))));
