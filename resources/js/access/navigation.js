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
// Monitoring for planning and office roles reuses the Management Overview and report master;
// the backend scopes the data to each account.
const monitoringDashboard = page('monitoring-dashboard', 'Monitoring Dashboard', '/monitoring-dashboard', ['strategic_records.view'], { icon: 'bi-speedometer2' });
const reports = page('monitoring-reports', 'Reports', '/monitoring-dashboard?tab=reports', ['reports.view'], { icon: 'bi-file-earmark-bar-graph' });
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
    // Role workspaces follow the planning stages. A later entry for a page that is already listed
    // is dashboardOnly: it appears as a home card but not twice in the sidebar.
    administrative: [
    group('admin-reference-preparation', 'Planning reference-data preparation', [
        page('home', 'Administrative Dashboard', '/dashboard', [], { icon: 'bi-speedometer2' }),
        page('agenda', 'Presidential Agenda Management', '/administrative-admin/reference-data?tab=agenda', ['reference_data.manage', 'presidential_agenda.view'], { icon: 'bi-bank' }),
        page('pdp', 'PDP Chapters Management', '/pdp-chapters/manage', ['pdp_chapters.manage'], { icon: 'bi-journal-bookmark' }),
        page('reference', 'Reference Data Management', '/administrative-admin/reference-data?tab=reference', ['reference_data.manage'], { icon: 'bi-collection' }),
    ], 'bi-journal-check'),
    group('admin-template-preparation', 'Planning-template preparation', [
        page('templates', 'Template Management', '/administrative-admin/templates', ['templates.manage'], { icon: 'bi-file-earmark-text' }),
    ], 'bi-file-earmark-text'),
    group('admin-monitoring', 'Administrative monitoring', [
        monitoringDashboard,
        reports,
        page('system-logs', 'System Logs', '/audit-logs', ['logs.view'], { icon: 'bi-list-check' }),
    ], 'bi-graph-up'),
    // Planning support granted by the enable_administrative_admin_planning migration.
    group('administrative-planning', 'Strategic Planning', [
        page('plans', 'Strategic Plan List', '/strategic-plans', ['strategic_records.view']),
        page('create-plan', 'Create Strategic Plan / MVC', '/strategic-plans/create', ['strategic_records.create']),
        page('objectives', 'Strategic Objectives', '/strategic-objectives', ['strategic_records.view', 'strategic_objectives.view']),
        inputs,
        page('finalize', 'Finalize & Submit', '/strategic-plans/finalize', ['strategic_records.update']),
        page('submission-status', 'Submission Status', '/strategic-plans', ['strategic_records.view'], { dashboardOnly: true, description: 'Open a plan to view its approval status and history.' }),
    ]),
    group('administrative-alignment', 'Strategic Alignment', [mapping, alignment], 'bi-map'),
    group('administrative-progress', 'Progress Monitoring', [
        page('objective-progress', 'Objective Progress', '/progress-monitoring', ['strategic_records.view', 'strategic_objectives.view_progress']),
    ], 'bi-graph-up'),
    group('administrative-reviews', 'Assigned Approvals', [page('reviews', 'Assigned Plan Reviews', '/management-approvals')])],
    planner: [
    group('planning', 'Initial strategic-plan creation', [
        page('home', 'Planning Dashboard', '/dashboard', [], { icon: 'bi-speedometer2' }),
        page('plans', 'Strategic Plan List', '/strategic-plans', ['strategic_records.view']),
        page('create-plan', 'Create Strategic Plan', '/strategic-plans/create', ['strategic_records.create']),
    ]),
    group('foundations', 'Strategic foundation development', [
        page('plan-editor', 'Strategic Plan Editor', '/strategic-plans', ['strategic_records.update'], { dashboardOnly: true, description: 'Open a plan from the Strategic Plan List and choose Edit.' }),
        page('mvc', 'Mission, Vision, and Core Values', '/strategic-plans', ['strategic_foundations.view'], { dashboardOnly: true, description: 'Edit them in the Strategic Plan Editor; a new plan starts with them in Create Strategic Plan.' }),
    ], 'bi-compass'),
    group('objective-development', 'Strategic-objective development', [
        page('objectives', 'Strategic Objectives', '/strategic-objectives', ['strategic_objectives.view']),
    ], 'bi-list-check'),
    group('mapping', 'Strategic alignment mapping', [
        mapping,
        { ...alignment, label: 'Agenda → PDP → DOST Mapping' },
        page('pdp-read', 'PDP Chapters', '/pdp-chapters', ['strategic_records.view']),
    ], 'bi-map'),
    group('input-collection', 'Office/Agency input collection', [{ ...inputs, label: 'Office/Agency Inputs' }], 'bi-inbox'),
    group('input-consolidation', 'Office/Agency input consolidation', [
        { ...inputs, id: 'input-consolidation', label: 'Input Consolidation', dashboardOnly: true, description: 'Review and consolidate submitted inputs on the Office/Agency Inputs page.' },
    ], 'bi-inboxes'),
    group('finalization', 'Strategic-plan finalization', [
        page('finalize', 'Strategic Plan Finalization', '/strategic-plans/finalize', ['strategic_records.update']),
        page('final-review', 'Final Review', '/strategic-plans/finalize', ['strategic_records.update'], { dashboardOnly: true, description: 'Check readiness and the plan summary on the finalization page.' }),
    ], 'bi-check2-square'),
    group('approval-submission', 'Approval submission', [
        page('submit-approval', 'Submit for Approval', '/strategic-plans/finalize', ['strategic_records.update'], { dashboardOnly: true, description: 'Submit a finalized plan from the finalization page.' }),
        page('submission-status', 'Submission Status', '/strategic-plans', ['strategic_records.view'], { dashboardOnly: true, description: 'Open a plan to view its submission status.' }),
    ], 'bi-send-check'),
    group('monitoring', 'Implementation monitoring', [{ ...progress, label: 'Objective Progress Monitoring' }, monitoringDashboard, reports], 'bi-graph-up'),
    group('reviews', 'Reviews', [page('reviews', 'Plan Reviews', '/management-approvals')])],
    office: [
    group('planning', 'Initial strategic-plan review', [
        page('home', 'Office/Agency Dashboard', '/dashboard', [], { icon: 'bi-speedometer2' }),
        { ...review, label: 'Initial Strategic Plan Review' },
    ]),
    group('input-submission', 'Planning-input submission', [
        { ...upload, label: 'Planning Inputs' },
        page('office-proposals', 'Proposed Objectives', '/office?view=proposal', ['strategic_records.view', 'implementation_inputs.create'], { icon: 'bi-lightbulb' }),
        page('office-comments', 'Comments', '/office?view=comments', ['strategic_records.view'], { icon: 'bi-chat-left-text' }),
    ], 'bi-upload'),
    group('mapping', 'Agency-level strategic mapping', [
        { ...alignment, label: 'Agency Mapping' },
        { ...alignment, id: 'agency-mapping-chain', label: 'Agenda → PDP → DOST → Agency Mapping', dashboardOnly: true, description: 'Read-only: the Agenda, PDP, DOST objective and agency links are shown on Agency Mapping.' },
    ], 'bi-map'),
    group('input-status', 'Input-processing status review', [
        page('input-status', 'Input Submission Status', '/consolidate-inputs', ['implementation_inputs.view']),
    ], 'bi-inbox'),
    group('assigned-objectives', 'Assigned-objective progress updates', [
        { ...progress, label: 'Assigned Objectives' },
        { ...progress, id: 'progress-update', label: 'Progress/Status Update', dashboardOnly: true, description: 'Update progress and status from Assigned Objectives.' },
        page('edit-objectives', 'Edit Objectives', '/office?view=edit', ['strategic_records.view', 'strategic_objectives.update']),
    ], 'bi-list-check'),
    group('monitoring', 'Agency implementation monitoring', [monitoringDashboard, reports], 'bi-graph-up')],
    // Management pages open the Management Dashboard tabs; duplicate labels for one page are dashboardOnly.
    management: [
    group('approval-preparation', 'Strategic-plan approval preparation', [
        page('dashboard', 'Executive Dashboard', '/management-dashboard', ['strategic_records.view'], { icon: 'bi-speedometer2' }),
        page('reviews-approvals', 'Approval List', '/management-dashboard?tab=approvals', ['strategic_records.view'], { icon: 'bi-clipboard-check' }),
    ], 'bi-clipboard-check'),
    group('plan-review-stage', 'Strategic-plan review', [
        page('plan-review', 'Strategic Plan Review', '/management-plan-review', ['strategic_records.view'], { icon: 'bi-journal-text' }),
        page('mvc-review', 'Mission, Vision, and Core Values Review', '/management-plan-review', ['strategic_records.view'], { dashboardOnly: true }),
        page('objectives-review', 'Strategic Objectives Review', '/management-plan-review', ['strategic_records.view'], { dashboardOnly: true }),
    ], 'bi-journal-text'),
    group('alignment-review', 'Strategic-alignment review', [
        page('alignment-performance', 'Strategic Alignment', '/management-dashboard?tab=alignment', ['strategic_records.view', 'strategic_objectives.view'], { icon: 'bi-diagram-3' }),
        page('agenda-pdp-review', 'Agenda/PDP Alignment Review', '/management-dashboard?tab=alignment', ['strategic_records.view', 'strategic_objectives.view'], { dashboardOnly: true }),
        page('inputs-consolidation', 'Agency Input Review', '/management-dashboard?tab=inputs', [], { anyPermissions: ['implementation_inputs.view', 'implementation_inputs.view_all'], icon: 'bi-building-check' }),
    ], 'bi-diagram-3'),
    group('plan-approval', 'Strategic-plan approval', [
        page('plan-approval', 'Strategic Plan Approval', '/management-dashboard?tab=approvals&queue=pending', ['strategic_records.view'], { icon: 'bi-check2-circle' }),
    ], 'bi-check2-circle'),
    group('oversight', 'Implementation oversight', [
        page('monitoring', 'Monitoring Dashboard', '/management-dashboard?tab=overview', ['strategic_records.view'], { icon: 'bi-graph-up' }),
        page('progress-summary', 'Progress Summary', '/management-dashboard?tab=overview', ['strategic_records.view'], { dashboardOnly: true }),
        page('reports', 'Reports', '/management-dashboard?tab=reports', ['reports.view'], { icon: 'bi-file-earmark-bar-graph' }),
    ], 'bi-graph-up'),
    ],
};
export const dashboardLabels = { technical: 'Technical Administration Dashboard', administrative: 'Administrative Dashboard', planner: 'Planning Dashboard', office: 'Office/Agency Dashboard', management: 'Executive Dashboard' };
export function navigationFor(role) {
    const kind = navigationRole(role);
    // Other workspaces list their dashboard inside the first stage.
    const home = kind === 'technical' ? [page('home', 'Dashboard', '/dashboard', [], { icon: 'bi-speedometer2' })] : [];
    return [...home, ...roleNavigation[kind], ...(kind === 'management' ? common : [group('account', 'Account and Help', common, 'bi-person-circle')])];
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
    const current = new URL(canonicalOfficeUrl(input), 'http://localhost');
    const target = new URL(item.href, 'http://localhost');
    if (item.id === 'objectives' && /^\/strategic-plans\/\d+\/objectives$/.test(current.pathname)) return true;
    if (current.pathname !== target.pathname) return false;
    if (['/management-dashboard', '/monitoring-dashboard'].includes(current.pathname)) {
        const tab = managementDashboardTab(current.searchParams);
        const queue = target.searchParams.get('queue');
        return tab === (target.searchParams.get('tab') || 'overview') && (!queue || current.searchParams.get('queue') === queue);
    }
    const keys = ['view', 'section', 'tab', 'feature', 'mode'];
    return keys.every(key => (current.searchParams.get(key) || '') === (target.searchParams.get(key) || ''));
}
export function pageForUrl(input, role) {
    return flattenNavigation(navigationFor(role)).find(item => !item.dashboardOnly && isCurrentPage(item, input));
}
