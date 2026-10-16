// Canonical frontend destinations. Permissions describe existing APIs; no grants are added here.
// One sidebar icon per destination, so a page shows the same icon in every role's menu.
// Group headings pass their own icon to group().
export const NAV_ICONS = {
    '/dashboard': 'bi-speedometer2',
    '/monitoring-dashboard': 'bi-speedometer2',
    '/management-dashboard': 'bi-speedometer2',
    '/strategic-plans': 'bi-journal-text',
    '/strategic-plans/create': 'bi-journal-plus',
    '/strategic-objectives': 'bi-bullseye',
    '/strategic-plans/finalize': 'bi-send-check',
    '/consolidate-inputs': 'bi-inbox',
    '/mappings': 'bi-diagram-3',
    '/mappings?mode=view': 'bi-map',
    '/pdp-chapters': 'bi-book',
    '/pdp-chapters/manage': 'bi-book',
    '/administrative-admin/reference-data?tab=agenda': 'bi-bank',
    '/administrative-admin/templates': 'bi-file-earmark-text',
    '/progress-monitoring': 'bi-graph-up-arrow',
    '/office?view=progress': 'bi-graph-up-arrow',
    '/management-approvals': 'bi-clipboard-check',
    '/management-dashboard?tab=approvals': 'bi-clipboard-check',
    '/management-plan-review': 'bi-eye',
    '/management-dashboard?tab=alignment': 'bi-bar-chart-line',
    '/management-dashboard?tab=inputs': 'bi-building-check',
    '/office': 'bi-journal-text',
    '/office?view=inputs': 'bi-cloud-upload',
    '/office?view=proposal': 'bi-lightbulb',
    '/office?view=comments': 'bi-chat-left-text',
    '/office?view=edit': 'bi-pencil-square',
    '/user-management': 'bi-people',
    '/role-management': 'bi-person-gear',
    '/role-management?section=permissions': 'bi-key',
    '/workflow-configuration': 'bi-diagram-2',
    '/login-history': 'bi-clock-history',
    '/system-monitoring': 'bi-activity',
    '/audit-logs': 'bi-card-list',
    '/settings': 'bi-shield-lock',
    '/manual-backup': 'bi-hdd-stack',
    '/how-spdms-works': 'bi-signpost-split',
    '/workflow-notifications': 'bi-bell',
    '/profile': 'bi-person',
    '/dashboard?feature=faq': 'bi-question-circle',
};
const page = (id, label, href, permissions = [], extra = {}) => ({ id, label, href, permissions, icon: NAV_ICONS[href] || 'bi-dot', ...extra });
const pending = (id, label, extra = {}) => page(id, label, `/dashboard?feature=${id}`, [], { placeholder: true, ...extra });
const group = (id, label, children, icon = 'bi-clipboard2-check', extra = {}) => ({ id, label, children, icon, ...extra });
// Groups whose pages are consecutive planning steps; their breadcrumb shows "Step n of m".
const steps = { sequence: true };
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
const monitoringDashboard = page('monitoring-dashboard', 'Dashboard', '/monitoring-dashboard', [], { anyPermissions: ['strategic_records.view', 'reports.view'] });
const common = [    page(
        'workflow-guide',
        'How SPDMS Works',
        '/how-spdms-works'),page('notifications', 'Notifications', '/workflow-notifications'), page('profile', 'Profile', '/profile'), pending('faq', 'FAQ')];
export const roleNavigation = {
    technical: [
    group('technical-planning-support', 'Planning Support', [
        page('plans', 'Strategic Plan List', '/strategic-plans', [
            'strategic_records.view',
        ]),
        page('objectives', 'Strategic Objectives', '/strategic-objectives', [
            'strategic_records.view',
            'strategic_objectives.view',
        ]),
        // Technical Admin deletes mappings, so it opens the mapping register rather than the read-only view.
        { ...mapping, label: 'Mappings' },
        page('technical-pdp-chapters', 'PDP Chapters', '/pdp-chapters/manage', [], {
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
            ['presidential_agenda.view']),
    ], 'bi-clipboard2-check'),
    group('accounts', 'Access Administration', [
        page('users', 'Users', '/user-management', ['users.view']),
        page('roles', 'Role Management', '/role-management', ['roles.manage', 'users.view', 'roles.view']),
        page('permissions', 'Permissions', '/role-management?section=permissions', ['roles.manage', 'roles.view', 'permissions.view']),
        page('workflow', 'Workflow Configuration', '/workflow-configuration'),
    ], 'bi-person-lock'), group('security', 'Account Security', [
        page('logins', 'Login History', '/login-history', ['login_history.view']),
        page('audit', 'Audit Logs', '/audit-logs', ['logs.view']),
        page('security-settings', 'Security Settings', '/settings', ['settings.manage']),
        page('maintenance', 'Backups', '/manual-backup', ['backups.view']),
        page('system-monitoring', 'System Monitoring', '/system-monitoring', ['system_monitoring.view']),
    ], 'bi-shield-check')],
    // Short menus: each function has one entry, single-item groups are top-level links, and Reports
    // is a tab inside each role's Dashboard rather than a separate link.
    // Administrative Admin submits plans but does not approve them, so it has no Plan Reviews entry.
    administrative: [monitoringDashboard,
    group('admin-references', 'Reference Data', [
        page('agenda', 'Presidential Agenda', '/administrative-admin/reference-data?tab=agenda', ['reference_data.manage', 'presidential_agenda.view']),
        page('pdp', 'PDP Chapters', '/pdp-chapters/manage', ['pdp_chapters.manage']),
        page('templates', 'Templates', '/administrative-admin/templates', ['templates.manage']),
    ], 'bi-journal-check'),
    // Planning support granted by the enable_administrative_admin_planning migration.
    group('administrative-planning', 'Planning', [
        page('plans', 'Plan List', '/strategic-plans', ['strategic_records.view']),
        page('create-plan', 'Create Plan', '/strategic-plans/create', ['strategic_records.create']),
        page('objectives', 'Objectives', '/strategic-objectives', ['strategic_records.view', 'strategic_objectives.view']),
        { ...inputs, label: 'Inputs' },
        page('finalize', 'Finalize & Submit', '/strategic-plans/finalize', ['strategic_records.update']),
    ], 'bi-clipboard2-check', steps),
    group('administrative-alignment', 'Alignment', [mapping, { ...alignment, label: 'Alignment View' }], 'bi-map'),
    group('admin-monitoring', 'Monitoring', [
        page('objective-progress', 'Objective Progress', '/progress-monitoring', ['strategic_records.view', 'strategic_objectives.view_progress']),
        page('system-logs', 'System Logs', '/audit-logs', ['logs.view']),
    ], 'bi-graph-up')],
    planner: [monitoringDashboard,
    group('planning', 'Plans', [
        page('plans', 'Plan List', '/strategic-plans', ['strategic_records.view']),
        page('create-plan', 'Create Plan', '/strategic-plans/create', ['strategic_records.create']),
        page('objectives', 'Objectives', '/strategic-objectives', ['strategic_objectives.view']),
        page('finalize', 'Finalize & Submit', '/strategic-plans/finalize', ['strategic_records.update']),
    ], 'bi-clipboard2-check', steps),
    group('mapping', 'Alignment', [mapping, { ...alignment, label: 'Alignment View' }, page('pdp-read', 'PDP Chapters', '/pdp-chapters', ['strategic_records.view'])], 'bi-map'),
    { ...inputs, label: 'Planning Inputs' },
    progress,
    page('reviews', 'Plan Reviews', '/management-approvals')],
    office: [monitoringDashboard,
    review,
    group('input-submission', 'Inputs', [
        { ...upload, label: 'Planning Inputs' },
        page('office-proposals', 'Proposed Objectives', '/office?view=proposal', ['strategic_records.view', 'implementation_inputs.create']),
        page('office-comments', 'Comments', '/office?view=comments', ['strategic_records.view']),
        page('input-status', 'Input Status', '/consolidate-inputs', ['implementation_inputs.view']),
    ], 'bi-upload'),
    // Offices update progress on their assigned objectives but do not edit objectives (client permission table).
    { ...progress, label: 'Progress Update' },
    { ...alignment, label: 'Agency Mapping' }],
    // Management opens the Management Dashboard tabs and Plan Review.
    management: [page('dashboard', 'Dashboard', '/management-dashboard', ['strategic_records.view']),
        page('reviews-approvals', 'Approvals', '/management-dashboard?tab=approvals', ['strategic_records.view']),
        page('plan-review', 'Plan Review', '/management-plan-review', ['strategic_records.view']),
        page(
    'management-proposals',
    'Suggest Objectives',
    '/office?view=proposal',
    ['strategic_records.view', 'implementation_inputs.create']),
        page('alignment-performance', 'Alignment', '/management-dashboard?tab=alignment', ['strategic_records.view', 'strategic_objectives.view']),
        page('inputs-consolidation', 'Input Review', '/management-dashboard?tab=inputs', [], { anyPermissions: ['implementation_inputs.view', 'implementation_inputs.view_all'] }),
        // Management views audit logs read-only for monitoring (client permission table).
        page('management-audit', 'Audit Logs', '/audit-logs', ['logs.view']),
    group('management-records', 'Planning Records', [
    page('management-plan-records', 'Plans', '/strategic-plans',
        ['strategic_records.view']),

    page('management-objective-records', 'Objectives', '/strategic-objectives',
        ['strategic_records.view', 'strategic_objectives.view']),

    page('management-mapping-records', 'Mappings', '/mappings',
        ['strategic_records.view', 'strategic_objectives.view'],
        {
            anyPermissions: ['strategic_alignments.delete'],
        }),

    page('management-pdp-records', 'PDP Chapters', '/pdp-chapters/manage',
        ['pdp_chapters.delete']),

    page('management-agenda-records', 'Presidential Agenda',
        '/administrative-admin/reference-data?tab=agenda',
        ['presidential_agenda.view', 'presidential_agenda.delete']),
], 'bi-folder2-open'),
    ],
};
export const dashboardLabels = { technical: 'Technical Administration Dashboard', administrative: 'Administrative Dashboard', planner: 'Planning Dashboard', office: 'Office/Agency Dashboard', management: 'Executive Dashboard' };
export function navigationFor(role) {
    const kind = navigationRole(role);
    // Only Technical Admin keeps /dashboard (the Technical Administration Dashboard); other workspaces start with their own Dashboard link.
    const home = kind === 'technical' ? [page('home', 'Dashboard', '/dashboard')] : [];
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

// Breadcrumb for the current page: Dashboard, then the sidebar group and page that match the URL.
// Pages inside a sequence group also report their step and neighbours, in sidebar order.
export function breadcrumbFor(input, role) {
    const dashboard = { label: 'Dashboard', href: dashboardHrefFor(role) };
    const entries = navigationFor(role);
    for (const entry of entries) {
        const children = entry.children ? entry.children.filter(child => !child.dashboardOnly) : null;
        const page = (children || [entry]).find(item => !item.alias && isCurrentPage(item, input));
        if (!page) continue;
        const index = children ? children.indexOf(page) : -1;
        return {
            dashboard, group: children ? { id: entry.id, label: entry.label } : null, page,
            step: children && entry.sequence ? { number: index + 1, total: children.length, previous: children[index - 1] || null, next: children[index + 1] || null } : null,
        };
    }
    return { dashboard, group: null, page: null, step: null };
}
