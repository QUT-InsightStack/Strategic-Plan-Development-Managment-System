// Canonical frontend destinations. Permissions describe existing APIs; no grants are added here.
const page = (id, label, href, permissions = [], extra = {}) => ({ id, label, href, permissions, ...extra });
const pending = (id, label, extra = {}) => page(id, label, `/dashboard?feature=${id}`, [], { placeholder: true, ...extra });
const group = (id, label, children, icon = 'bi-clipboard2-check') => ({ id, label, children, icon });
export const isOfficeRole = role => ['Office', 'Office Representative', 'Office/Agency', 'Offices / Agencies', 'Responsible Unit User'].includes(role);
export function navigationRole(role) {
    if (['Administrator', 'Technical Administrator', 'Technical Admin', 'test'].includes(role)) return 'technical';
    if (['Administrative Admin', 'Administrative Administrator'].includes(role)) return 'administrative';
    if (isOfficeRole(role)) return 'office';
    if (['Management', 'Executive', 'Management / Executive', 'Division Head'].includes(role)) return 'management';
    return 'planner';
}
const review = page('office-review', 'Plans & Objectives', '/office', ['strategic_records.view']);
const upload = page('office-upload', 'Upload Planning Files', '/office?view=inputs', ['strategic_records.view', 'strategic_documents.upload']);
const progress = page('progress', 'Objective Progress', '/office?view=progress', ['strategic_records.view'], { anyPermissions: ['strategic_objectives.view_progress', 'strategic_objectives.update_progress', 'strategic_objectives.correct_progress'] });
const mapping = page('mapping', 'Strategic Mapping', '/mappings', ['strategic_records.view', 'strategic_objectives.view'], { anyPermissions: ['strategic_objectives.update', 'strategic_alignments.archive', 'strategic_alignments.delete'] });
const alignment = page('alignment', 'View Strategic Alignment', '/mappings?mode=view', ['strategic_records.view', 'strategic_objectives.view']);
const inputs = page('inputs', 'Consolidate Inputs', '/consolidate-inputs', ['implementation_inputs.view']);
// Planning, office and administrative roles' Dashboard: the Management Overview and report master
// (Reports tab), scoped by the backend to each account.
const monitoringDashboard = page('monitoring-dashboard', 'Dashboard', '/monitoring-dashboard', [], { anyPermissions: ['strategic_records.view', 'reports.view'], icon: 'bi-speedometer2' });
const common = [    page(
        'workflow-guide',
        'How SPDMS Works',
        '/how-spdms-works',
        [],
        { icon: 'bi-signpost-split' }
    ),page('notifications', 'Notifications', '/workflow-notifications', [], { icon: 'bi-bell' }), page('profile', 'Profile', '/profile', [], { icon: 'bi-person' }), pending('faq', 'FAQ', { icon: 'bi-question-circle' })];
export const roleNavigation = {
    technical: [
    group('technical-planning-support', 'Planning Support', [
        page('plans', 'Strategic Plan List', '/strategic-plans', [
            'strategic_records.view',
        ], {
            icon: 'bi-journal-text',
        }),
        page('objectives', 'Strategic Objectives', '/strategic-objectives', [
            'strategic_records.view',
            'strategic_objectives.view',
        ], {
            icon: 'bi-list-check',
        }),
              alignment,
        page('technical-pdp-chapters', 'PDP Chapters', '/pdp-chapters/manage', [], {
            icon: 'bi-book',
            anyPermissions: [
                'pdp_chapters.manage',
                'pdp_chapters.archive',
                'pdp_chapters.delete',
            ],
        }),
                page(
            'technical-agenda',
            'Presidential Agenda',
            '/administrative-admin/reference-data?tab=agenda',
            ['presidential_agenda.view'],
            { icon: 'bi-bank' }
        ),
    ], 'bi-clipboard2-check'),
    group('accounts', 'Access Administration', [
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
    // Short menus: each function has one entry, single-item groups are top-level links, and Reports
    // is a tab inside each role's Dashboard rather than a separate link.
    administrative: [monitoringDashboard,
    group('admin-references', 'Reference Data', [
        page('agenda', 'Presidential Agenda', '/administrative-admin/reference-data?tab=agenda', ['reference_data.manage', 'presidential_agenda.view'], { icon: 'bi-bank' }),
        page('pdp', 'PDP Chapters', '/pdp-chapters/manage', ['pdp_chapters.manage'], { icon: 'bi-journal-bookmark' }),
        page('reference', 'Reference Data', '/administrative-admin/reference-data?tab=reference', ['reference_data.manage'], { icon: 'bi-collection' }),
        page('templates', 'Templates', '/administrative-admin/templates', ['templates.manage'], { icon: 'bi-file-earmark-text' }),
    ], 'bi-journal-check'),
    // Planning support granted by the enable_administrative_admin_planning migration.
    group('administrative-planning', 'Planning', [
        page('plans', 'Plan List', '/strategic-plans', ['strategic_records.view']),
        page('create-plan', 'Create Plan', '/strategic-plans/create', ['strategic_records.create']),
        page('objectives', 'Objectives', '/strategic-objectives', ['strategic_records.view', 'strategic_objectives.view']),
        { ...inputs, label: 'Inputs' },
        page('finalize', 'Finalize & Submit', '/strategic-plans/finalize', ['strategic_records.update']),
    ], 'bi-clipboard2-check'),
    group('administrative-alignment', 'Alignment', [mapping, { ...alignment, label: 'Alignment View' }], 'bi-map'),
    group('admin-monitoring', 'Monitoring', [
        page('objective-progress', 'Objective Progress', '/progress-monitoring', ['strategic_records.view', 'strategic_objectives.view_progress']),
        page('system-logs', 'System Logs', '/audit-logs', ['logs.view'], { icon: 'bi-list-check' }),
    ], 'bi-graph-up'),
    page('reviews', 'Plan Reviews', '/management-approvals', [], { icon: 'bi-clipboard-check' })],
    planner: [monitoringDashboard,
    group('planning', 'Plans', [
        page('plans', 'Plan List', '/strategic-plans', ['strategic_records.view']),
        page('create-plan', 'Create Plan', '/strategic-plans/create', ['strategic_records.create']),
        page('objectives', 'Objectives', '/strategic-objectives', ['strategic_objectives.view']),
        page('finalize', 'Finalize & Submit', '/strategic-plans/finalize', ['strategic_records.update']),
    ], 'bi-clipboard2-check'),
    group('mapping', 'Alignment', [mapping, { ...alignment, label: 'Alignment View' }, page('pdp-read', 'PDP Chapters', '/pdp-chapters', ['strategic_records.view'])], 'bi-map'),
    { ...inputs, label: 'Office Inputs', icon: 'bi-inbox' },
    { ...progress, icon: 'bi-graph-up' },
    page('reviews', 'Plan Reviews', '/management-approvals', [], { icon: 'bi-clipboard-check' })],
    office: [monitoringDashboard,
    { ...review, icon: 'bi-journal-text' },
    group('input-submission', 'Inputs', [
        { ...upload, label: 'Planning Inputs' },
        page('office-proposals', 'Proposed Objectives', '/office?view=proposal', ['strategic_records.view', 'implementation_inputs.create'], { icon: 'bi-lightbulb' }),
        page('office-comments', 'Comments', '/office?view=comments', ['strategic_records.view'], { icon: 'bi-chat-left-text' }),
        page('input-status', 'Input Status', '/consolidate-inputs', ['implementation_inputs.view']),
    ], 'bi-upload'),
    group('assigned-objectives', 'My Objectives', [
        { ...progress, label: 'Progress Update' },
        page('edit-objectives', 'Edit Objectives', '/office?view=edit', ['strategic_records.view', 'strategic_objectives.update']),
    ], 'bi-list-check'),
    { ...alignment, label: 'Agency Mapping', icon: 'bi-map' }],
    // Management opens the Management Dashboard tabs and Plan Review.
    management: [page('dashboard', 'Dashboard', '/management-dashboard', ['strategic_records.view'], { icon: 'bi-speedometer2' }),
        page('reviews-approvals', 'Approvals', '/management-dashboard?tab=approvals', ['strategic_records.view'], { icon: 'bi-clipboard-check' }),
        page('plan-review', 'Plan Review', '/management-plan-review', ['strategic_records.view'], { icon: 'bi-journal-text' }),
        page('alignment-performance', 'Alignment', '/management-dashboard?tab=alignment', ['strategic_records.view', 'strategic_objectives.view'], { icon: 'bi-diagram-3' }),
        page('inputs-consolidation', 'Input Review', '/management-dashboard?tab=inputs', [], { anyPermissions: ['implementation_inputs.view', 'implementation_inputs.view_all'], icon: 'bi-building-check' }),
    ],
};
export const dashboardLabels = { technical: 'Technical Administration Dashboard', administrative: 'Administrative Dashboard', planner: 'Planning Dashboard', office: 'Office/Agency Dashboard', management: 'Executive Dashboard' };
export function navigationFor(role) {
    const kind = navigationRole(role);
    // Only Technical Admin keeps the /dashboard function-card page; other workspaces start with their own Dashboard link.
    const home = kind === 'technical' ? [page('home', 'Dashboard', '/dashboard', [], { icon: 'bi-speedometer2' })] : [];
    return [...home, ...roleNavigation[kind], ...(kind === 'management' ? common : [group('account', 'Account and Help', common, 'bi-person-circle')])];
}
// Where a role's Dashboard link points; /dashboard redirects administrative, planner and office roles here.
export function dashboardHrefFor(role) {
    if (!role) return '/dashboard';
    const kind = navigationRole(role);
    if (kind === 'management') return '/management-dashboard';
    return kind === 'technical' ? '/dashboard' : '/monitoring-dashboard';
}
export function flattenNavigation(items) { return items.flatMap(item => item.children ? flattenNavigation(item.children) : [item]); }
export function canOpenPage(item, session) {
    if (!session) return false;
    const granted = permission => session.permissions?.includes('*') || session.permissions?.includes(permission);
    return (!item.permissions || item.permissions.every(granted)) && (!item.anyPermissions || item.anyPermissions.some(granted));
}
// Management dashboard tabs; older Monitoring links (?tab=dashboard / monitoring) open the Overview.
export function managementDashboardTab(params) {
    const tab = params.get('tab') || '';
    if (tab === 'inputs' || (tab === 'alignment' && params.get('section') === 'agency')) return 'inputs';
    return ['alignment', 'approvals', 'reports'].includes(tab) ? tab : 'overview';
}
export function canonicalOfficeUrl(input) {
    const url = new URL(input, 'http://localhost');
    if (url.pathname === '/office' && url.searchParams.get('view') === 'agency-input') url.searchParams.set('view', 'inputs');
    return url.pathname + url.search + url.hash;
}
export function isCurrentPage(item, input) {
    if (item.alias) return false;
    const current = new URL(canonicalOfficeUrl(input), 'http://localhost');
    const target = new URL(item.href, 'http://localhost');
    if (item.id === 'objectives' && /^\/strategic-plans\/\d+\/objectives$/.test(current.pathname)) return true;
    if (current.pathname !== target.pathname) return false;
    if (['/management-dashboard', '/monitoring-dashboard'].includes(current.pathname)) {
        const tab = managementDashboardTab(current.searchParams);
        const queue = target.searchParams.get('queue');
        // The Dashboard link covers its Overview and Reports tabs; other tabs have their own links.
        if (!target.searchParams.get('tab')) return ['overview', 'reports'].includes(tab);
        return tab === target.searchParams.get('tab') && (!queue || current.searchParams.get('queue') === queue);
    }
    const keys = ['view', 'section', 'tab', 'feature', 'mode'];
    return keys.every(key => (current.searchParams.get(key) || '') === (target.searchParams.get(key) || ''));
}
export function pageForUrl(input, role) {
    return flattenNavigation(navigationFor(role)).find(item => !item.dashboardOnly && isCurrentPage(item, input));
}
