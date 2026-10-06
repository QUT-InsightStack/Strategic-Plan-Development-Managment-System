// Canonical frontend destinations. Permissions describe existing APIs; no grants are added here.
const page = (id, label, href, permissions = [], extra = {}) => ({ id, label, href, permissions, ...extra });
const pending = (id, label) => page(id, label, `/dashboard?feature=${id}`, [], { placeholder: true });
const group = (id, label, children, icon = 'bi-clipboard2-check') => ({ id, label, children, icon });
export const isOfficeRole = role => ['Office', 'Office Representative', 'Office/Agency', 'Offices / Agencies', 'Responsible Unit User'].includes(role);
export function navigationRole(role) {
    if (['Administrator', 'Technical Administrator', 'Technical Admin', 'test'].includes(role)) return 'technical';
    if (['Administrative Admin', 'Administrative Administrator'].includes(role)) return 'administrative';
    if (isOfficeRole(role)) return 'office';
    if (['Management', 'Executive', 'Management / Executive', 'Division Head'].includes(role)) return 'management';
    return 'planner';
}
const review = page('office-review', 'Plan Review', '/office', ['strategic_records.view']);
const upload = page('office-upload', 'Upload Planning Files', '/office?view=inputs', ['strategic_records.view', 'strategic_documents.upload']);
const progress = page('progress', 'Objective Progress', '/office?view=progress', ['strategic_records.view'], { anyPermissions: ['strategic_objectives.view_progress', 'strategic_objectives.update_progress', 'strategic_objectives.correct_progress'] });
const mapping = page('mapping', 'Strategic Mapping', '/mappings', ['strategic_records.view', 'strategic_objectives.view'], { anyPermissions: ['relations.manage', 'relations.create'], source: 'local' });
const alignment = page('alignment', 'View Strategic Alignment', '/mappings?mode=view', ['strategic_records.view', 'relations.view'], { source: 'local' });
const inputs = page('inputs', 'Consolidate Inputs', '/consolidate-inputs', ['implementation_inputs.view']);
const common = [page('notifications', 'Notifications', '/workflow-notifications'), page('profile', 'Profile', '/profile'), pending('faq', 'FAQ')];
export const roleNavigation = {
    technical: [group('accounts', 'Access Administration', [
        page('users', 'Users', '/user-management', ['users.view']),
        page('roles', 'Role Management', '/role-management', ['roles.manage', 'users.view', 'roles.view']),
        page('permissions', 'Permissions', '/role-management?section=permissions', ['roles.manage', 'roles.view', 'permissions.view']),
        page('workflow', 'Workflow Configuration', '/workflow-configuration'),
    ], 'bi-person-lock'), group('security', 'Account Security', [
        page('logins', 'Login History', '/login-history', ['login_history.view']),
        pending('security-logs', 'Security Logs'),
        page('audit', 'Audit Logs', '/audit-logs', ['logs.view']),
        page('security-settings', 'Security Settings', '/settings', ['settings.manage']),
        page('maintenance', 'Backups', '/manual-backup', ['backups.view']),
    ], 'bi-shield-check')],
    administrative: [group('references', 'Planning Preparation', [
        page('agenda', 'Presidential Agenda', '/administrative-admin/reference-data?tab=agenda', ['reference_data.manage', 'presidential_agenda.view']),
        page('pdp', 'PDP Chapters', '/pdp-chapters/manage', ['pdp_chapters.manage']),
        page('reference', 'Reference Data', '/administrative-admin/reference-data?tab=reference', ['reference_data.manage']),
        page('templates', 'Templates', '/administrative-admin/templates', ['templates.manage']),
    ]), group('admin-monitoring', 'Monitoring', [pending('admin-monitoring', 'Monitoring Dashboard'), pending('admin-reports', 'Reports'), page('system-logs', 'System Logs', '/audit-logs', ['logs.view'])], 'bi-graph-up')],
    planner: [group('planning', 'Planning', [
        page('plans', 'Strategic Plan List', '/strategic-plans', ['strategic_records.view']),
        page('create-plan', 'Create Strategic Plan / MVC', '/strategic-plans/create', ['strategic_records.create']),
        page('objectives', 'Strategic Objectives', '/strategic-objectives', ['strategic_objectives.view']),
        inputs,
        page('finalize', 'Finalize & Submit', '/strategic-plans/finalize', ['strategic_records.update']),
        page('submission-status', 'Submission Status', '/strategic-plans', ['strategic_records.view'], { dashboardOnly: true, description: 'Open a plan to view its submission status.' }),
    ]), group('mapping', 'Mapping', [mapping, alignment, page('pdp-read', 'PDP Chapters', '/pdp-chapters', ['strategic_records.view'])], 'bi-map'),
    group('monitoring', 'Monitoring', [progress, pending('planner-monitoring', 'Monitoring Dashboard'), pending('planner-reports', 'Reports')], 'bi-graph-up'),
    group('reviews', 'Reviews', [page('reviews', 'Plan Reviews', '/management-approvals')])],
    office: [group('planning', 'Planning', [review, upload,
        page('proposals', 'Proposed Objectives', '/office?view=proposal', ['strategic_records.view', 'implementation_inputs.create']),
        page('comments', 'Plan Comments', '/office?view=comments', ['strategic_records.view', 'objective_comments.create']),
        page('input-status', 'Input Submission Status', '/consolidate-inputs', ['implementation_inputs.view']),
        page('edit-objectives', 'Edit Objectives', '/office?view=edit', ['strategic_records.view', 'strategic_objectives.update']),
    ]), group('mapping', 'Agency Mapping', [{ ...mapping, label: 'Add Agency to Mapping' }, alignment], 'bi-map'),
    group('monitoring', 'Monitoring', [{ ...progress, label: 'Progress Updates' }, pending('office-monitoring', 'Monitoring Dashboard'), pending('office-reports', 'Reports')], 'bi-graph-up')],
    management: [page('approval-list', 'Approve List', '/management-approvals', [], { icon: 'bi-clipboard-check' }),
        page('plan-review', 'Plan Review', '/management-plan-review', ['strategic_records.view'], { icon: 'bi-journal-text' }),
        page('objectives-review', 'Objectives Review', '/management-plan-review?view=objectives', ['strategic_records.view', 'strategic_objectives.view'], { icon: 'bi-list-check' }),
        page('alignment-review', 'Strategic Alignment Review', '/management-dashboard?tab=alignment', ['relations.view'], { icon: 'bi-diagram-3' }),
        page('agency-input-review', 'Agency Input Review', '/management-dashboard?tab=alignment&section=agency', ['relations.view', 'strategic_objectives.view'], { icon: 'bi-building-check' }),
        page('monitoring', 'Monitoring', '/management-dashboard?tab=dashboard', ['strategic_records.view'], { icon: 'bi-graph-up' }),
        page('reports', 'Reports & Summary', '/management-dashboard?tab=reports', ['strategic_records.view'], { icon: 'bi-file-earmark-bar-graph' }),
    ],
};
export const dashboardLabels = { technical: 'Technical Administration Dashboard', administrative: 'Administrative Dashboard', planner: 'Planning Dashboard', office: 'Office/Agency Dashboard', management: 'Executive Dashboard' };
export function navigationFor(role) {
    const kind = navigationRole(role);
    const home = kind === 'management' ? [] : [page('home', 'Dashboard', '/dashboard', [], { icon: 'bi-speedometer2' })];
    return [...home, ...roleNavigation[kind], ...(kind === 'management' ? common : [group('account', 'Account and Help', common, 'bi-person-circle')])];
}
export function flattenNavigation(items) { return items.flatMap(item => item.children ? flattenNavigation(item.children) : [item]); }
export function canOpenPage(item, session) {
    if (!session) return false;
    const granted = permission => session.permissions?.includes('*') || session.permissions?.includes(permission);
    return (!item.permissions || item.permissions.every(granted)) && (!item.anyPermissions || item.anyPermissions.some(granted));
}
export function canonicalOfficeUrl(input) {
    const url = new URL(input, 'http://localhost');
    if (url.pathname === '/office' && url.searchParams.get('view') === 'agency-input') url.searchParams.set('view', 'inputs');
    return url.pathname + url.search + url.hash;
}
export function isCurrentPage(item, input) {
    const current = new URL(canonicalOfficeUrl(input), 'http://localhost');
    const target = new URL(item.href, 'http://localhost');
    if (item.id === 'objectives' && /^\/strategic-plans\/\d+\/objectives$/.test(current.pathname)) return true;
    if (current.pathname !== target.pathname) return false;
    if (item.id === 'monitoring' && current.pathname === '/management-dashboard' && !current.searchParams.has('tab')) return true;
    if (item.id === 'alignment-review' && current.pathname === '/management-dashboard' && current.searchParams.get('tab') === 'alignment') return current.searchParams.get('section') !== 'agency';
    const keys = ['view', 'section', 'tab', 'feature', 'mode'];
    return keys.every(key => (current.searchParams.get(key) || '') === (target.searchParams.get(key) || ''));
}
export function pageForUrl(input, role) {
    return flattenNavigation(navigationFor(role)).find(item => !item.dashboardOnly && isCurrentPage(item, input));
}
