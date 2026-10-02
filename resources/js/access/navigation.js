// Canonical frontend destinations. Permissions describe existing APIs; no grants are added here.
const page = (id, label, href, permissions = [], extra = {}) => ({ id, label, href, permissions, ...extra });
const pending = (id, label, extra = {}) => page(id, label, `/dashboard?feature=${id}`, [], { placeholder: true, ...extra });
const group = (id, label, children, icon = 'bi-clipboard2-check') => ({ id, label, children, icon });
export const isOfficeRole = role => ['Office', 'Office Representative', 'Office/Agency', 'Offices / Agencies', 'Responsible Unit User'].includes(role);
export function navigationRole(role) {
    if (['Administrator', 'Technical Administrator', 'Technical Admin', 'test'].includes(role)) return 'technical';
    if (['Administrative Admin', 'Administrative Administrator'].includes(role)) return 'administrative';
    if (isOfficeRole(role)) return 'office';
    if (['Management', 'Executive', 'Management / Executive'].includes(role)) return 'management';
    return 'planner';
}
const review = page('office-review', 'Plan Review', '/office', ['strategic_records.view']);
const upload = page('office-upload', 'Upload Planning Files', '/office?view=inputs', ['strategic_records.view', 'strategic_documents.upload']);
const progress = page('progress', 'Objective Progress', '/office?view=progress', ['strategic_records.view'], { anyPermissions: ['strategic_objectives.view_progress', 'strategic_objectives.update_progress', 'strategic_objectives.correct_progress'] });
const mapping = page('mapping', 'Strategic Mapping', '/mappings', ['strategic_records.view', 'strategic_objectives.view'], { anyPermissions: ['relations.manage', 'relations.create'], source: 'local' });
const alignment = page('alignment', 'View Strategic Alignment', '/mappings?mode=view', ['strategic_records.view', 'relations.view'], { source: 'local' });
const inputs = page('inputs', 'Consolidate Inputs', '/consolidate-inputs', ['implementation_inputs.view']);
const common = [page('notifications', 'Notifications', '/workflow-notifications', [], { icon: 'bi-bell' }), page('profile', 'Profile', '/profile', [], { icon: 'bi-person' }), pending('faq', 'FAQ', { icon: 'bi-question-circle' })];
export const roleNavigation = {
    technical: [group('accounts', 'Access Administration', [
        page('users', 'Users', '/user-management', ['users.view'], { icon: 'bi-people' }),
        page('roles', 'Role Management', '/role-management', ['roles.manage', 'users.view', 'roles.view'], { icon: 'bi-person-gear' }),
        page('permissions', 'Permissions', '/role-management?section=permissions', ['roles.manage', 'roles.view', 'permissions.view'], { icon: 'bi-key' }),
        page('workflow', 'Workflow Configuration', '/workflow-configuration', [], { icon: 'bi-diagram-3' }),
    ], 'bi-person-lock'), group('security', 'Account Security', [
        page('logins', 'Login History', '/login-history', ['login_history.view'], { icon: 'bi-clock-history' }),
        pending('security-logs', 'Security Logs', { icon: 'bi-shield-exclamation' }),
        page('audit', 'Audit Logs', '/audit-logs', ['logs.view'], { icon: 'bi-journal-text' }),
        page('security-settings', 'Security Settings', '/settings', ['settings.manage'], { icon: 'bi-shield-lock' }),
        page('maintenance', 'Backups', '/manual-backup', ['backups.view'], { icon: 'bi-hdd-stack' }),
    ], 'bi-shield-check')],
    administrative: [group('references', 'Planning Preparation', [
        page('agenda', 'Presidential Agenda', '/administrative-admin/reference-data?tab=agenda', ['reference_data.manage', 'presidential_agenda.view'], { icon: 'bi-bank' }),
        page('pdp', 'PDP Chapters', '/pdp-chapters/manage', ['pdp_chapters.manage'], { icon: 'bi-journal-bookmark' }),
        page('reference', 'Reference Data', '/administrative-admin/reference-data?tab=reference', ['reference_data.manage'], { icon: 'bi-collection' }),
        page('templates', 'Templates', '/administrative-admin/templates', ['templates.manage'], { icon: 'bi-file-earmark-text' }),
    ], 'bi-journal-check'), group('admin-monitoring', 'Administrative Monitoring', [pending('admin-monitoring', 'Monitoring Dashboard', { icon: 'bi-speedometer2' }), pending('admin-reports', 'Reports', { icon: 'bi-file-earmark-bar-graph' }), page('system-logs', 'System Logs', '/audit-logs', ['logs.view'], { icon: 'bi-list-check' })], 'bi-graph-up')],
    planner: [group('planning', 'Planning', [
        page('plans', 'Strategic Plan List', '/strategic-plans', ['strategic_records.view']),
        page('create-plan', 'Create Strategic Plan / MVC', '/strategic-plans/create', ['strategic_records.create']),
        page('objectives', 'Strategic Objectives', '/strategic-objectives', ['strategic_objectives.view']),
        inputs,
        page('finalize', 'Finalize & Submit', '/strategic-plans/finalize', ['strategic_records.update']),
        page('submission-status', 'Submission Status', '/strategic-plans', ['strategic_records.view'], { dashboardOnly: true, description: 'Open a plan to view its submission status.' }),
    ]), group('mapping', 'Mapping', [mapping, alignment, page('pdp-read', 'PDP Chapters', '/pdp-chapters', ['strategic_records.view'])], 'bi-map'),
    group('monitoring', 'Monitoring', [progress, pending('planner-monitoring', 'Monitoring Dashboard'), pending('planner-reports', 'Reports')], 'bi-graph-up'),
    group('reviews', 'Reviews', [page('reviews', 'Plan Reviews', '/strategic-plan-reviews')])],
    office: [group('planning', 'Planning', [review, upload,
        page('proposals', 'Proposed Objectives', '/office?view=proposal', ['strategic_records.view', 'implementation_inputs.create']),
        page('comments', 'Plan Comments', '/office?view=comments', ['strategic_records.view', 'objective_comments.create']),
        page('input-status', 'Input Submission Status', '/consolidate-inputs', ['implementation_inputs.view']),
        page('edit-objectives', 'Edit Objectives', '/office?view=edit', ['strategic_records.view', 'strategic_objectives.update']),
    ]), group('mapping', 'Agency Mapping', [{ ...mapping, label: 'Add Agency to Mapping' }, alignment], 'bi-map'),
    group('monitoring', 'Monitoring', [{ ...progress, label: 'Progress Updates' }, pending('office-monitoring', 'Monitoring Dashboard'), pending('office-reports', 'Reports')], 'bi-graph-up')],
    management: [page('approval-list', 'Approval List', '/strategic-plan-reviews'),
        group('planning', 'Planning', [page('plan-review', 'Plan Review', '/management-plan-review', ['strategic_records.view'])]),
        group('alignment', 'Alignment Review', [page('alignment-review', 'Agenda / PDP Alignment', '/management-dashboard?tab=alignment', ['relations.view']), { ...inputs, label: 'Agency Input Review' }, page('documents', 'Reference Documents', '/management-dashboard?tab=alignment&section=documents', ['strategic_documents.view'])], 'bi-diagram-3'),
        group('monitoring', 'Monitoring', [page('monitoring', 'Progress Summary', '/management-dashboard?tab=dashboard', ['strategic_records.view']), page('reports', 'Reports', '/management-dashboard?tab=reports', ['strategic_records.view']), progress], 'bi-graph-up'),
        group('additional', 'More Functions', [page('finalize', 'Finalize Plans', '/strategic-plans/finalize', ['strategic_records.update'], { hideWhenDenied: true })]),
    ],
};
export const dashboardLabels = { technical: 'Technical Administration Dashboard', administrative: 'Administrative Dashboard', planner: 'Planning Dashboard', office: 'Office/Agency Dashboard', management: 'Executive Dashboard' };
export function navigationFor(role) {
    const kind = navigationRole(role);
    const dashboardLabel = kind === 'administrative' ? 'Administrative Dashboard' : 'Dashboard';
    return [page('home', dashboardLabel, kind === 'management' ? '/management-dashboard' : '/dashboard', [], { icon: 'bi-speedometer2' }), ...roleNavigation[kind], group('account', 'Account and Help', common, 'bi-person-circle')];
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
    const keys = ['view', 'section', 'tab', 'feature', 'mode'];
    return keys.every(key => (current.searchParams.get(key) || '') === (target.searchParams.get(key) || ''));
}
export function pageForUrl(input, role) {
    return flattenNavigation(navigationFor(role)).find(item => !item.dashboardOnly && isCurrentPage(item, input));
}
