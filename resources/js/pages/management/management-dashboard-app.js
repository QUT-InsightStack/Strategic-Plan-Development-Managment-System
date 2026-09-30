import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { apiRequest } from '../../api/api-client.js';
import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { listAllStrategicObjectives } from '../../api/strategic-objectives-api.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { PERMISSIONS } from '../../access/access-policy.js';
import { can, createAccessSession, saveAccessSession } from '../../access/access-session.js';
import { isManagementSession, managementLevel } from '../../access/management-access.js';
import { isSubmissionAssignedToReviewer, listAssignedPlanSubmissions } from '../../api/plan-approval-api.js';
import { listAllLocalAgencyInputs, listAllLocalProgressUpdates } from '../../data/office-demo-storage.js';
import { listAllLocalMappings } from '../../mappings/mapping-storage.js';
import {
    APPROVAL_LABELS,
    INPUT_STATUS_LABELS,
    OBJECTIVE_STATUS_LABELS,
    PLAN_STATUS_LABELS,
    PROGRESS_STATUS_LABELS,
    RISK_THRESHOLDS,
    buildDashboard,
    emptyFilters,
    filterOptions,
    hasActiveFilters,
} from '../../data/management-dashboard-data.js';

const h = React.createElement;
const { useEffect, useMemo, useState } = React;

// The list endpoints cap per_page at 100; stop after this many pages so a
// very large portfolio cannot stall the dashboard.
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

const APPROVAL_BADGES = { not_submitted: 'neutral', under_approval: 'info', approved: 'success', returned: 'warning', rejected: 'danger' };

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

async function loadAllPages(request) {
    const rows = [];
    let page = 1;
    let lastPage = 1;

    do {
        const payload = await request({ page, per_page: PAGE_SIZE });
        rows.push(...(payload.data || []));
        lastPage = Number(payload.meta?.last_page) || 1;
        page += 1;
    } while (page <= lastPage && page <= MAX_PAGES);

    return { rows, truncated: lastPage > MAX_PAGES };
}

function readLocal(reader) {
    try { return reader(); } catch { return []; }
}

function attachSubmission(plan, submission) {
    if (!submission) return plan;
    return {
        ...plan,
        approval_status: plan.approval_status || submission.status,
        approval_stage: submission.currentStage,
        approval_submission: submission,
    };
}

async function loadDashboardData() {
    const [plansResult, objectivesResult, reviewsResult] = await Promise.allSettled([
        loadAllPages(listStrategicPlans),
        can(PERMISSIONS.OBJECTIVES_VIEW) ? loadAllPages(listAllStrategicObjectives) : Promise.resolve(null),
        listAssignedPlanSubmissions(),
    ]);

    // Plans are the backbone of every summary; without them there is nothing
    // meaningful to show, so that failure is reported as a page error.
    if (plansResult.status === 'rejected') throw plansResult.reason;

    const warnings = [];
    let objectives = [];

    if (objectivesResult.status === 'rejected') {
        warnings.push(objectivesResult.reason?.status === 403
            ? 'Objective details are outside your assigned access, so objective, alignment and unit summaries are limited.'
            : `Objective data could not be loaded: ${objectivesResult.reason?.message || 'unknown error'}.`);
    } else if (objectivesResult.value === null) {
        warnings.push('Your role does not include objective access, so objective, alignment and unit summaries are limited.');
    } else {
        objectives = objectivesResult.value.rows;
        if (objectivesResult.value.truncated) warnings.push(`Only the ${PAGE_SIZE * MAX_PAGES} most recently updated objectives are summarised.`);
    }

    // Submissions assigned to this reviewer carry the current stage and
    // history; other plans still report their approval status on the plan.
    const submissions = new Map();
    if (reviewsResult.status === 'fulfilled') {
        reviewsResult.value.forEach((submission) => submissions.set(Number(submission.planId), submission));
    } else if (reviewsResult.reason?.status !== 403) {
        warnings.push(`Approval stage details could not be loaded: ${reviewsResult.reason?.message || 'unknown error'}.`);
    }

    if (plansResult.value.truncated) warnings.push(`Only the ${PAGE_SIZE * MAX_PAGES} most recently updated plans are summarised.`);

    return {
        data: {
            plans: plansResult.value.rows.map((plan) => attachSubmission(plan, submissions.get(Number(plan.record_id)))),
            objectives,
            inputs: readLocal(listAllLocalAgencyInputs),
            progressUpdates: readLocal(listAllLocalProgressUpdates),
            mappings: readLocal(listAllLocalMappings),
        },
        warnings,
        loadedAt: new Date(),
    };
}

/* ---------- presentational pieces ---------- */

function Panel({ id, title, subtitle, icon, className = '', actions = null, children }) {
    return h('section', { className: `ui-card mgmt-panel ${className}`.trim(), 'aria-labelledby': `${id}-title` },
        h('div', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' },
                h('h2', { id: `${id}-title` }, title),
                subtitle ? h('p', null, subtitle) : null),
            actions || (icon ? h('i', { className: `bi ${icon}`, 'aria-hidden': 'true' }) : null)),
        h('div', { className: 'ui-card__body' }, children));
}

function Empty({ children }) {
    return h('p', { className: 'mgmt-empty' }, children);
}

function Kpi({ label, value, detail, icon, tone = 'primary' }) {
    return h('article', { className: `mgmt-kpi mgmt-kpi--${tone}` },
        h('i', { className: `bi ${icon}`, 'aria-hidden': 'true' }),
        h('div', null,
            h('span', { className: 'mgmt-kpi__label' }, label),
            h('strong', { className: 'mgmt-kpi__value' }, value),
            detail ? h('small', null, detail) : null));
}

function BarList({ label, rows, total }) {
    const max = Math.max(total || 0, ...rows.map((row) => row.value), 1);
    return h('ul', { className: 'mgmt-bars', 'aria-label': label },
        rows.map((row) => h('li', { key: row.key, className: `mgmt-bars__row is-${row.key}` },
            h('span', { className: 'mgmt-bars__label' }, row.label),
            h('span', { className: 'mgmt-bars__track', 'aria-hidden': 'true' },
                h('span', { className: 'mgmt-bars__fill', style: { width: `${(row.value / max) * 100}%` } })),
            h('strong', { className: 'mgmt-bars__value' }, row.value))));
}

function Meter({ value, label }) {
    return h('div', { className: 'mgmt-meter', role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': value, 'aria-label': label },
        h('span', { className: 'mgmt-meter__fill', style: { width: `${value}%` } }));
}

function rowsFrom(labels, counts) {
    return Object.entries(labels).map(([key, label]) => ({ key, label, value: counts[key] || 0 }));
}

function SkeletonDashboard() {
    return h('div', { className: 'mgmt-skeleton', 'aria-hidden': 'true' },
        h('div', { className: 'mgmt-kpis' }, [1, 2, 3, 4, 5].map((key) => h('div', { key, className: 'mgmt-skeleton__block mgmt-skeleton__block--kpi' }))),
        h('div', { className: 'mgmt-grid' }, [1, 2, 3, 4].map((key) => h('div', { key, className: 'mgmt-skeleton__block' }))));
}

/* ---------- filters ---------- */

function Filters({ filters, options, onChange, onClear, disabled }) {
    function select(key, label, choices, allLabel) {
        const id = `mgmt-filter-${key}`;
        return h('div', { className: 'ui-field', key },
            h('label', { className: 'ui-label', htmlFor: id }, label),
            h('select', { id, className: 'ui-select', value: filters[key], disabled, onChange: (event) => onChange({ ...filters, [key]: event.target.value }) },
                h('option', { value: '' }, allLabel),
                choices.map((choice) => h('option', { key: choice.value, value: choice.value }, choice.label))));
    }

    const toChoices = (labels) => Object.entries(labels).map(([value, label]) => ({ value, label }));

    return h('section', { className: 'ui-card mgmt-filters-card', 'aria-labelledby': 'mgmt-filters-title' },
        h('div', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' },
                h('h2', { id: 'mgmt-filters-title' }, 'Filter dashboard'),
                h('p', null, 'Filters apply to every summary below.')),
            h('i', { className: 'bi bi-funnel', 'aria-hidden': 'true' })),
        h('div', { className: 'ui-card__body' },
            h('div', { className: 'mgmt-filters' },
                select('plan', 'Strategic Plan', options.plans, 'All plans'),
                select('period', 'Planning period', options.periods.map((value) => ({ value, label: value })), 'All periods'),
                select('office', 'Office / Unit', options.offices.map((value) => ({ value, label: value })), 'All offices and units'),
                select('planStatus', 'Plan status', toChoices({ draft: PLAN_STATUS_LABELS.draft, finished: PLAN_STATUS_LABELS.finished }), 'All plan statuses'),
                select('objectiveStatus', 'Objective status', toChoices(OBJECTIVE_STATUS_LABELS), 'All objective statuses'),
                select('approvalStatus', 'Approval status', toChoices(APPROVAL_LABELS), 'All approval statuses'),
                h('div', { className: 'mgmt-filters__actions' },
                    h('button', { type: 'button', className: 'ui-button ui-button--secondary', onClick: onClear, disabled: disabled || !hasActiveFilters(filters) }, 'Clear filters')))));
}

/* ---------- management controls ---------- */

// Only planning-governance controls appear here, and each only with its own
// permission. Technical security, configuration, backup, restore and
// maintenance screens are intentionally never linked from this dashboard.
const CONTROL_LINKS = [
    { label: 'Manage or delete plans', href: '/strategic-plans', icon: 'bi-journal-x', permission: PERMISSIONS.PLANS_DELETE },
    { label: 'Manage or delete objectives', href: '/strategic-objectives', icon: 'bi-bullseye', permission: PERMISSIONS.OBJECTIVES_DELETE },
    { label: 'Manage alignment mappings', href: '/mappings', icon: 'bi-diagram-3', permission: PERMISSIONS.MAPPINGS_MANAGE },
    { label: 'Manage reference data', href: '/administrative-admin/reference-data', icon: 'bi-collection', permission: PERMISSIONS.REFERENCE_DATA_MANAGE },
    { label: 'Manage user accounts', href: '/user-management', icon: 'bi-people', permission: PERMISSIONS.USERS_MANAGE },
    { label: 'Manage roles and permissions', href: '/role-management', icon: 'bi-shield-lock', permission: PERMISSIONS.ROLES_MANAGE },
    { label: 'Edit planning content', href: '/strategic-plans', icon: 'bi-pencil-square', permission: PERMISSIONS.PLANS_UPDATE },
];

// Shortcuts to the review and oversight screens, each shown only with its
// own permission.
const QUICK_LINKS = [
    { title: 'Assigned Plan Reviews', description: 'Review assigned strategic plans and record an approval decision when you are the assigned reviewer.', icon: 'bi-clipboard-check', href: '/strategic-plan-reviews', permission: PERMISSIONS.PLANS_VIEW },
    { title: 'Strategic Plans', description: 'Browse strategic plans and review plan details within your access.', icon: 'bi-journal-text', href: '/strategic-plans', permission: PERMISSIONS.PLANS_VIEW },
    { title: 'Agenda and PDP Alignment', description: 'View alignment between the Presidential Agenda, PDP chapters, DOST objectives and agency plans.', icon: 'bi-diagram-3', href: '/mappings?mode=view', permission: 'relations.view' },
    { title: 'Agency Input Review', description: 'Review submitted implementation inputs and their decisions across authorised plans.', icon: 'bi-building-check', href: '/consolidate-inputs', permission: PERMISSIONS.INPUTS_VIEW },
    { title: 'Objective Progress', description: 'View objective progress, calculated status, update dates and history.', icon: 'bi-bar-chart-line', href: '/office?view=progress', permission: PERMISSIONS.OBJECTIVES_VIEW_PROGRESS },
];

/* ---------- page ---------- */

function ManagementDashboardApp({ session }) {
    const [state, setState] = useState({ loading: true, error: '', data: null, warnings: [], loadedAt: null });
    const [filters, setFilters] = useState(emptyFilters);
    const [refresh, setRefresh] = useState(0);
    const [notice, setNotice] = useState(null);

    useEffect(() => {
        let active = true;
        setState((current) => ({ ...current, loading: true, error: '' }));
        loadDashboardData()
            .then((result) => { if (active) setState({ loading: false, error: '', ...result }); })
            .catch((error) => { if (active) setState((current) => ({ ...current, loading: false, error: error.message || 'The dashboard could not be loaded.' })); });
        return () => { active = false; };
    }, [refresh]);

    const options = useMemo(() => filterOptions(state.data || {}), [state.data]);
    const dashboard = useMemo(() => state.data ? buildDashboard(state.data, filters) : null, [state.data, filters]);
    const level = managementLevel(session);
    const controls = CONTROL_LINKS.filter((link) => can(link.permission, session));
    const quickLinks = QUICK_LINKS.filter((link) => can(link.permission, session));
    const filtered = hasActiveFilters(filters);
    const noData = state.data && !state.data.plans.length;
    const noMatches = dashboard && !noData && !dashboard.scoped.plans.length;

    const header = h(PageHeader, {
        section: 'Management Dashboard',
        title: 'Management Dashboard',
        subtitle: 'Monitor strategic plan status, objective progress, alignment, approvals and office performance within your assigned scope.',
        actions: h('button', { type: 'button', className: 'ui-button ui-button--secondary', onClick: () => setRefresh((value) => value + 1), disabled: state.loading },
            h('i', { className: `bi bi-arrow-clockwise${state.loading ? ' mgmt-spin' : ''}`, 'aria-hidden': 'true' }), state.loading ? 'Refreshing…' : 'Refresh'),
    });

    const scope = h('div', { className: 'mgmt-scope', role: 'note' },
        h('span', null, h('i', { className: 'bi bi-person-badge', 'aria-hidden': 'true' }), `Level: ${level}`),
        h('span', null, h('i', { className: 'bi bi-diagram-2', 'aria-hidden': 'true' }), `Scope: ${session.office ? `${session.office} and plans you are authorised to view` : 'plans you are authorised to view'}`),
        state.loadedAt ? h('span', null, h('i', { className: 'bi bi-clock', 'aria-hidden': 'true' }), `Updated ${state.loadedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`) : null);

    let body;

    if (state.error && !state.data) {
        body = h('div', { className: 'ui-status ui-status--error mgmt-error', role: 'alert' },
            h('p', null, state.error),
            h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', onClick: () => setRefresh((value) => value + 1) }, 'Try again'));
    } else if (!dashboard) {
        body = h('div', { role: 'status', 'aria-live': 'polite' },
            h('p', { className: 'ui-visually-hidden' }, 'Loading the management dashboard…'),
            h(SkeletonDashboard));
    } else if (noData) {
        body = h('div', { className: 'ui-card' }, h('div', { className: 'ui-card__body' },
            h(Empty, null, 'There are no strategic plans within your scope yet. Summaries will appear here once plans are created.')));
    } else {
        const { plans, objectives, alignment, units, inputs, awaiting, decided, risks } = dashboard;

        body = h(React.Fragment, null,
            h(Filters, { filters, options, onChange: setFilters, onClear: () => setFilters(emptyFilters), disabled: state.loading }),
            noMatches
                ? h('div', { className: 'ui-card' }, h('div', { className: 'ui-card__body' },
                    h(Empty, null, 'No planning records match these filters.'),
                    h('div', { className: 'mgmt-center' }, h('button', { type: 'button', className: 'ui-button ui-button--secondary', onClick: () => setFilters(emptyFilters) }, 'Clear filters'))))
                : h(React.Fragment, null,
                    h('div', { className: 'mgmt-kpis', 'aria-label': 'Key figures' },
                        h(Kpi, { label: 'Strategic plans', value: plans.total, detail: `${plans.byStatus.draft} draft · ${plans.byStatus.finished} finished`, icon: 'bi-journal-text' }),
                        h(Kpi, { label: 'Average objective progress', value: `${objectives.averageProgress}%`, detail: `${objectives.reported} of ${objectives.total} objectives reporting`, icon: 'bi-graph-up-arrow', tone: 'info' }),
                        h(Kpi, { label: 'Alignment coverage', value: `${alignment.coverage}%`, detail: `${alignment.aligned} of ${alignment.total} objectives mapped`, icon: 'bi-diagram-3', tone: 'success' }),
                        h(Kpi, { label: 'Awaiting approval', value: awaiting.length, detail: `${plans.byApproval.approved} approved · ${plans.byApproval.returned + plans.byApproval.rejected} returned or rejected`, icon: 'bi-hourglass-split', tone: 'warning' }),
                        h(Kpi, { label: 'Overdue or at risk', value: risks.length, detail: `${risks.filter((item) => item.severity === 'overdue').length} overdue`, icon: 'bi-exclamation-triangle', tone: risks.length ? 'danger' : 'success' })),

                    h('div', { className: 'mgmt-grid' },
                        h(Panel, { id: 'mgmt-plans', title: 'Strategic Plan status', subtitle: 'Planning and approval stage of plans in scope', icon: 'bi-journal-check' },
                            h('h3', { className: 'mgmt-subheading' }, 'Planning status'),
                            h(BarList, { label: 'Plans by planning status', total: plans.total, rows: [{ key: 'draft', label: 'Draft', value: plans.byStatus.draft }, { key: 'finished', label: 'Finished', value: plans.byStatus.finished }] }),
                            h('h3', { className: 'mgmt-subheading' }, 'Approval status'),
                            h(BarList, { label: 'Plans by approval status', total: plans.total, rows: rowsFrom(APPROVAL_LABELS, plans.byApproval) })),

                        h(Panel, { id: 'mgmt-progress', title: 'Objective progress', subtitle: 'Latest progress reported by responsible offices', icon: 'bi-graph-up' },
                            objectives.total
                                ? h(React.Fragment, null,
                                    h('div', { className: 'mgmt-meter-row' }, h('strong', null, `${objectives.averageProgress}%`), h('span', null, 'average reported progress')),
                                    h(Meter, { value: objectives.averageProgress, label: 'Average objective progress' }),
                                    h(BarList, { label: 'Objectives by progress status', total: objectives.total, rows: rowsFrom(PROGRESS_STATUS_LABELS, objectives.byProgress) }),
                                    h('p', { className: 'mgmt-footnote' }, `${objectives.byStatus.published} published · ${objectives.byStatus.draft} draft · ${objectives.byStatus.archived} archived objectives`))
                                : h(Empty, null, 'No objectives in scope.')),

                        h(Panel, { id: 'mgmt-alignment', title: 'Strategic alignment coverage', subtitle: 'Objectives mapped to the Presidential Agenda and PDP chapters', icon: 'bi-diagram-3' },
                            alignment.total
                                ? h(React.Fragment, null,
                                    h('div', { className: 'mgmt-meter-row' }, h('strong', null, `${alignment.coverage}%`), h('span', null, 'of active objectives are aligned')),
                                    h(Meter, { value: alignment.coverage, label: 'Alignment coverage' }),
                                    h('dl', { className: 'mgmt-facts' },
                                        h('div', null, h('dt', null, 'Aligned'), h('dd', null, alignment.aligned)),
                                        h('div', null, h('dt', null, 'Not yet aligned'), h('dd', null, alignment.unaligned))),
                                    can(PERMISSIONS.MAPPINGS_MANAGE, session) || can('relations.view', session)
                                        ? h('a', { className: 'mgmt-link', href: '/mappings' }, 'Review alignment', h('i', { className: 'bi bi-arrow-right', 'aria-hidden': 'true' }))
                                        : null)
                                : h(Empty, null, 'No active objectives to measure alignment against.')),

                        h(Panel, { id: 'mgmt-inputs', title: 'Inputs and consolidation', subtitle: 'Office and agency inputs received for plans in scope', icon: 'bi-inboxes' },
                            inputs.total
                                ? h(React.Fragment, null,
                                    h('dl', { className: 'mgmt-facts' },
                                        h('div', null, h('dt', null, 'Reviewed'), h('dd', null, `${inputs.reviewRate}%`)),
                                        h('div', null, h('dt', null, 'Consolidated'), h('dd', null, `${inputs.consolidationRate}%`))),
                                    h(BarList, { label: 'Inputs by review status', total: inputs.total, rows: rowsFrom(INPUT_STATUS_LABELS, inputs.byStatus) }),
                                    can(PERMISSIONS.PLANS_UPDATE, session)
                                        ? h('a', { className: 'mgmt-link', href: '/consolidate-inputs' }, 'Open consolidation', h('i', { className: 'bi bi-arrow-right', 'aria-hidden': 'true' }))
                                        : null)
                                : h(Empty, null, 'No inputs have been submitted for these plans.'))),

                    h(Panel, { id: 'mgmt-units', title: 'Office / Unit performance', subtitle: 'Objective delivery by responsible office or unit', icon: 'bi-buildings', className: 'mgmt-panel--wide' },
                        units.length
                            ? h('div', { className: 'ui-table-wrap' }, h('table', { className: 'ui-table mgmt-table' },
                                h('thead', null, h('tr', null, ['Office / Unit', 'Objectives', 'Reporting', 'Average progress', 'Completed', 'Blocked'].map((label) => h('th', { key: label, scope: 'col' }, label)))),
                                h('tbody', null, units.map((unit) => h('tr', { key: unit.name },
                                    h('th', { scope: 'row' }, unit.name),
                                    h('td', null, unit.objectives),
                                    h('td', null, `${unit.reported} of ${unit.objectives}`),
                                    h('td', null, h('div', { className: 'mgmt-inline-meter' }, h(Meter, { value: unit.averageProgress, label: `${unit.name} average progress` }), h('span', null, `${unit.averageProgress}%`))),
                                    h('td', null, `${unit.completed} (${unit.completionRate}%)`),
                                    h('td', null, unit.blocked ? h('span', { className: 'ui-badge ui-badge--danger' }, unit.blocked) : '0'))))))
                            : h(Empty, null, 'No objectives have been assigned to offices or units yet.')),

                    h(Panel, { id: 'mgmt-awaiting', title: 'Plans awaiting approval', subtitle: 'Review actions appear only where you are the assigned reviewer', icon: 'bi-hourglass-split', className: 'mgmt-panel--wide' },
                        awaiting.length
                            ? h('div', { className: 'ui-table-wrap' }, h('table', { className: 'ui-table mgmt-table' },
                                h('thead', null, h('tr', null, ['Strategic Plan', 'Current stage', 'Assigned approver', 'Submitted', 'Waiting', 'Actions'].map((label) => h('th', { key: label, scope: 'col' }, label)))),
                                h('tbody', null, awaiting.map((item) => {
                                    const assigned = isSubmissionAssignedToReviewer(item.plan.approval_submission, session);
                                    return h('tr', { key: item.plan.record_id },
                                        h('th', { scope: 'row' }, item.plan.title || `Plan ${item.plan.record_id}`),
                                        h('td', null, item.stage ? `${item.stage.name}${item.totalStages ? ` (${item.stage.sequence} of ${item.totalStages})` : ''}` : '—'),
                                        h('td', null, item.stage?.approver || '—'),
                                        h('td', null, formatDate(item.submittedAt)),
                                        h('td', null, item.waitingDays === null ? '—' : h('span', { className: `ui-badge ui-badge--${item.waitingDays >= RISK_THRESHOLDS.approvalOverdueDays ? 'danger' : 'neutral'}` }, `${item.waitingDays} day${item.waitingDays === 1 ? '' : 's'}`)),
                                        h('td', null, assigned
                                            ? h('a', { className: 'ui-button ui-button--primary ui-button--sm', href: `/strategic-plan-reviews/${item.plan.record_id}` }, 'Review')
                                            : h('span', { className: 'mgmt-muted' }, 'View only')));
                                }))))
                            : h(Empty, null, 'No plans are waiting for approval.')),

                    h('div', { className: 'mgmt-grid' },
                        h(Panel, { id: 'mgmt-decided', title: 'Approved, returned and rejected plans', subtitle: 'Most recent approval outcomes', icon: 'bi-check2-square' },
                            decided.length
                                ? h('ul', { className: 'mgmt-list' }, decided.slice(0, 8).map((item) => h('li', { key: item.plan.record_id },
                                    h('div', null,
                                        h('strong', null, item.plan.title || `Plan ${item.plan.record_id}`),
                                        h('small', null, [item.stageName, formatDate(item.decidedAt)].filter(Boolean).join(' · ')),
                                        item.note ? h('p', null, item.note) : null),
                                    h('span', { className: `ui-badge ui-badge--${APPROVAL_BADGES[item.status]}` }, APPROVAL_LABELS[item.status]))))
                                : h(Empty, null, 'No approval decisions have been recorded yet.')),

                        h(Panel, { id: 'mgmt-risks', title: 'Overdue or at-risk items', subtitle: `Approvals waiting ${RISK_THRESHOLDS.approvalOverdueDays}+ days, inputs pending ${RISK_THRESHOLDS.inputReviewOverdueDays}+ days, blocked or stale objectives`, icon: 'bi-exclamation-triangle' },
                            risks.length
                                ? h('ul', { className: 'mgmt-list' }, risks.slice(0, 10).map((item) => h('li', { key: item.id },
                                    h('div', null,
                                        h('strong', null, h('a', { href: item.href }, item.title)),
                                        h('small', null, item.category),
                                        h('p', null, item.detail)),
                                    h('span', { className: `ui-badge ui-badge--${item.severity === 'overdue' ? 'danger' : 'warning'}` }, item.severity === 'overdue' ? 'Overdue' : 'At risk'))))
                                : h(Empty, null, 'Nothing is overdue or at risk.'))),

                    quickLinks.length
                        ? h(Panel, { id: 'mgmt-quick-links', title: 'Quick links', subtitle: 'Planning and oversight screens available to your role', icon: 'bi-grid', className: 'mgmt-panel--wide' },
                            h('div', { className: 'management-dashboard__grid' }, quickLinks.map((link) => h('article', { className: 'ui-card management-dashboard__card', key: link.title },
                                h('div', { className: 'management-dashboard__card-heading' },
                                    h('span', { className: 'management-dashboard__icon', 'aria-hidden': 'true' }, h('i', { className: `bi ${link.icon}` })),
                                    h('h3', null, link.title)),
                                h('p', null, link.description),
                                h('a', { className: 'ui-button ui-button--primary ui-button--sm', href: link.href }, 'Open')))))
                        : null,

                    controls.length
                        ? h(Panel, { id: 'mgmt-controls', title: 'Management controls', subtitle: 'Shown only for permissions assigned to you', icon: 'bi-sliders', className: 'mgmt-panel--wide' },
                            h('div', { className: 'mgmt-controls' }, controls.map((link) => h('a', { key: link.label, className: 'mgmt-control', href: link.href },
                                h('i', { className: `bi ${link.icon}`, 'aria-hidden': 'true' }), h('span', null, link.label)))))
                        : null));
    }

    return h('div', { className: 'mgmt-shell' },
        h(AppSidebar, { active: 'Home', onNotice: (message) => setNotice({ type: 'info', message }) }),
        h('main', { className: 'app-shell-main mgmt-page', 'aria-busy': state.loading },
            h('div', { className: 'app-shell-container' },
                header,
                scope,
                notice ? h('div', { className: `ui-status ui-status--${notice.type}`, role: 'status', 'aria-live': 'polite' }, notice.message) : null,
                state.error && state.data ? h('div', { className: 'ui-status ui-status--error', role: 'alert' }, `Refresh failed: ${state.error}`) : null,
                state.warnings.map((warning) => h('div', { key: warning, className: 'ui-status ui-status--info', role: 'note' }, warning)),
                filtered && dashboard && !noMatches ? h('p', { className: 'mgmt-filter-note', role: 'status' }, `Showing ${dashboard.scoped.plans.length} of ${state.data.plans.length} plans.`) : null,
                body)));
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h('p', { className: 'mgmt-boot', role: 'status' }, 'Loading your access…'));

apiRequest('/api/auth/me')
    .then((payload) => {
        const session = saveAccessSession(createAccessSession(payload.data));
        if (!enforcePageAccess()) return;
        if (!isManagementSession(session)) {
            window.location.replace('/access-denied');
            return;
        }
        root.render(h(ManagementDashboardApp, { session }));
    })
    .catch((error) => root.render(h('div', { className: 'mgmt-boot ui-status ui-status--error', role: 'alert' }, error.message || 'Your access could not be loaded.')));
