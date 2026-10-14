import { createPageRoot } from '../../navigation/page-root.js';
import { usePageQuery } from '../../navigation/use-page-query.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { apiRequest } from '../../api/api-client.js';
import { listAllStrategicObjectives } from '../../api/strategic-objectives-api.js';
import { listAssignedPlanSubmissions, isSubmissionAssignedToReviewer } from '../../api/plan-approval-api.js';
import { listSubmittedInputs } from '../../api/implementation-inputs-api.js';
import { createAccessSession, saveAccessSession, can } from '../../access/access-session.js';
import { PERMISSIONS as P } from '../../access/access-policy.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { isManagementSession } from '../../access/management-access.js';
import { managementDashboardTab } from '../../access/navigation.js';
import { ManagementPagination, pageRows } from '../../components/ManagementPagination.js';
import {
    chartPeriod, filterManagementRows, isAligned, objectiveRisk, officeName, officePerformance, officeUnitPerformance,
    periodLabel, planMatchesFilters, planPeriodKey, progressPercent, progressStatus, scopeFilters, sixYearProgress,
} from './management-insights.js';
import { getManagementProgressTimeline, listAuthorizedManagementPlans, loadAllManagementPages, managementDateLabel } from './management-data.js';
import { ManagementFilterBar, PlanningPeriodSelect, hasManagementFilters, useManagementFilters } from './management-filters.js';
import { EmptyState, SectionCard, sectionGate, useManagementSource } from './management-sections.js';
import { ApprovalsPanel, approvalSection, mergeAssignedPlans } from './management-approvals.js';
import { AttentionRequired, OfficePerformanceTable, PendingActions, PlanProgressMonitor, ProgressBreakdownTable, SixYearChart } from './management-overview.js';

const h = React.createElement;
const statusLabels = { completed: 'Completed', in_progress: 'Ongoing', not_started: 'Not Started' };
const TABS = [
    { id: 'overview', label: 'Overview', icon: 'bi-grid-1x2' },
    { id: 'alignment', label: 'Alignment & Performance', icon: 'bi-diagram-3' },
    { id: 'inputs', label: 'Inputs & Consolidation', icon: 'bi-inboxes' },
    { id: 'approvals', label: 'Reviews & Approvals', icon: 'bi-clipboard-check' },
    { id: 'reports', label: 'Reports & Summary', icon: 'bi-file-earmark-bar-graph' },
];

class ManagementErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        if (!this.state.failed) return this.props.children;
        return h('main', { className: 'management-dashboard__content' },
            h('div', { className: 'management-dashboard__errors', role: 'alert' },
                h('h1', null, 'Management page could not be displayed'),
                h('p', null, 'Refresh the page to try again. If the problem continues, check the browser console for details.'),
                h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', onClick: () => window.location.reload() }, 'Reload page')));
    }
}

function labelFor(items, fields) {
    if (!Array.isArray(items) || !items.length) return '—';
    return items.map(item => fields.map(field => item?.[field]).find(Boolean)).filter(Boolean).join(', ') || '—';
}

function downloadCsv(filename, rows) {
    if (!rows.length) return;
    const headings = Object.keys(rows[0]);
    const escape = value => {
        const raw = String(value ?? '');
        const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
        return `"${safe.replaceAll('"', '""')}"`;
    };
    const content = [headings, ...rows.map(row => headings.map(key => row[key]))]
        .map(row => row.map(escape).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿', content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

const agendaLabel = item => labelFor(item.presidential_agenda_items, ['title', 'item_title', 'agenda_title', 'name']);
const chapterLabel = item => labelFor(item.pdp_chapters, ['chapter_title', 'title', 'name']);
const sourceState = (...sources) => sources.some(source => source.status === 'error') ? 'error'
    : sources.some(source => source.status === 'loading') ? 'loading'
        : sources.some(source => source.status === 'forbidden') ? 'forbidden' : 'ready';

function KpiCard({ card }) {
    const body = card.state === 'loading'
        ? h(React.Fragment, null, h('span', { className: 'management-skeleton management-skeleton--value', 'aria-hidden': true }), h('span', { className: 'ui-visually-hidden' }, 'Loading'))
        : card.state === 'error'
            ? h(React.Fragment, null, h('strong', null, '—'), h('button', { className: 'management-link-button', type: 'button', onClick: card.retry }, 'Could not load · Retry'))
            : card.state === 'forbidden'
                ? h(React.Fragment, null, h('strong', { className: 'is-muted' }, 'No access'), h('span', null, card.forbidden))
                : h(React.Fragment, null, h('strong', null, card.value), h('span', null, card.detail), card.extra || null);
    return h('article', { className: `management-kpi is-${card.tone}`, 'aria-busy': card.state === 'loading' },
        h('span', { className: 'management-kpi__icon' }, h('i', { className: `bi ${card.icon}`, 'aria-hidden': true })),
        h('span', { className: 'management-kpi__copy' }, h('small', null, card.label), body));
}

function statusPill(state) {
    const labels = { completed: 'Completed', in_progress: 'Ongoing', not_started: 'Not Started', overdue: 'Delayed' };
    return h('span', { className: `management-status is-${state}` }, labels[state]);
}

function ManagementDashboard({ session }) {
    const pageQuery = usePageQuery();
    const [search, setSearch] = React.useState(() => new URLSearchParams(pageQuery));
    React.useEffect(() => { setSearch(new URLSearchParams(pageQuery)); }, [String(pageQuery)]);
    React.useEffect(() => {
        const restore = () => setSearch(new URLSearchParams(window.location.search));
        window.addEventListener('popstate', restore);
        return () => window.removeEventListener('popstate', restore);
    }, []);
    const { filters, setFilter, resetFilters } = useManagementFilters(search);
    const canViewObjectives = can('strategic_objectives.view', session);
    const canViewInputs = can(P.INPUTS_VIEW, session) || can('implementation_inputs.view_all', session);
    const canReview = can(P.PLANS_VIEW, session);
    const visibleTabs = TABS.filter(tab => tab.id !== 'inputs' || canViewInputs);
    const requestedTab = managementDashboardTab(search);
    const activeTab = visibleTabs.some(tab => tab.id === requestedTab) ? requestedTab : 'overview';
    const queue = approvalSection(search.get('queue'));

    const [refresh, setRefresh] = React.useState(0);
    const plansSource = useManagementSource(listAuthorizedManagementPlans, { deps: [refresh] });
    const objectivesSource = useManagementSource(() => loadAllManagementPages(listAllStrategicObjectives), { enabled: canViewObjectives, deps: [refresh] });
    const reviewsSource = useManagementSource(listAssignedPlanSubmissions, { enabled: canReview, deps: [refresh] });
    const inputsSource = useManagementSource(() => loadAllManagementPages(listSubmittedInputs), { enabled: canViewInputs, deps: [refresh] });

    const [inputStatus, setInputStatus] = React.useState('');
    const [inputCategory, setInputCategory] = React.useState('');
    const [activeReport, setActiveReport] = React.useState('');
    const [alignmentPage, setAlignmentPage] = React.useState(1);
    const [agencyPage, setAgencyPage] = React.useState(1);
    const [reportPage, setReportPage] = React.useState(1);
    React.useEffect(() => { setAlignmentPage(1); setAgencyPage(1); setReportPage(1); }, [JSON.stringify(filters)]);

    function navigate(changes) {
        const url = new URL(window.location.href);
        Object.entries(changes).forEach(([key, value]) => { if (value) url.searchParams.set(key, value); else url.searchParams.delete(key); });
        if (url.href === window.location.href) return;
        window.history.pushState(window.history.state, '', url);
        setSearch(new URLSearchParams(url.search));
    }
    const openTab = tab => { navigate({ tab: tab === 'overview' ? '' : tab, section: '', queue: tab === 'approvals' ? queue : '' }); setActiveReport(''); };

    const plans = plansSource.data;
    const objectives = objectivesSource.data;
    const reviews = reviewsSource.data;
    const inputs = inputsSource.data;
    const scope = scopeFilters(filters);
    const filtered = hasManagementFilters(filters);
    const currentObjectives = objectives.filter(objective => !['archived', 'deleted'].includes(objective.status));
    const scoped = filterManagementRows(plans, currentObjectives, scope, inputs);
    const filteredPlans = scoped.plans;
    const filteredObjectives = scoped.objectives;
    const offices = [...new Set([...currentObjectives.map(officeName), ...inputs.map(input => input.responsible_office_agency), ...plans.map(plan => plan.department_agency)].filter(Boolean))].sort();
    const allowedPlanIds = new Set(filteredPlans.map(plan => String(plan.record_id)));
    const allowedObjectiveIds = new Set(filteredObjectives.map(objective => String(objective.objective_id)));
    const filteredInputs = inputs.filter(input => allowedPlanIds.has(String(input.strategic_plan_id))
        && (!scope.office || input.responsible_office_agency === scope.office)
        && (!scope.objectiveStatus || allowedObjectiveIds.has(String(input.objective_id))));
    const filteredReviews = reviews.filter(review => allowedPlanIds.has(String(review.planId)));
    const plansById = new Map(filteredPlans.map(plan => [String(plan.record_id), plan]));
    const approvedPlans = filteredPlans.filter(plan => plan.approval_status === 'approved');
    const approvedPlansById = new Map(approvedPlans.map(plan => [String(plan.record_id), plan]));
    // Execution figures (progress, overdue, office performance) cover approved plans, as before.
    const executionObjectives = filteredObjectives.filter(objective => approvedPlansById.has(String(objective.strategic_plan_id)));
    const completed = executionObjectives.filter(item => progressStatus(item) === 'completed').length;
    const ongoing = executionObjectives.filter(item => progressStatus(item) === 'in_progress').length;
    const alignedCount = filteredObjectives.filter(isAligned).length;
    const alignmentCoverage = filteredObjectives.length ? Math.round(alignedCount * 100 / filteredObjectives.length) : 0;
    const riskRows = executionObjectives.map(objective => ({ objective, plan: approvedPlansById.get(String(objective.strategic_plan_id)) }))
        .map(row => ({ ...row, risk: objectiveRisk(row.objective, row.plan) })).filter(row => row.risk);
    const pendingPlans = filteredPlans.filter(plan => plan.approval_status === 'under_approval');
    const returnedPlans = filteredPlans.filter(plan => plan.approval_status === 'rejected');
    const performanceRows = officePerformance(executionObjectives);
    const officeRows = officeUnitPerformance(executionObjectives, { plansById: approvedPlansById, inputs: filteredInputs });
    const inputCounts = { pending: filteredInputs.filter(item => item.review_status === 'Pending Review').length,
        approved: filteredInputs.filter(item => item.review_status === 'Approved').length,
        rejected: filteredInputs.filter(item => item.review_status === 'Rejected').length };
    const consolidationRows = [...filteredInputs.reduce((groups, input) => {
        const office = input.responsible_office_agency || 'Unassigned';
        const row = groups.get(office) || { office, total: 0, pending: 0, approved: 0, rejected: 0 };
        row.total += 1;
        if (input.review_status === 'Pending Review') row.pending += 1;
        if (input.review_status === 'Approved') row.approved += 1;
        if (input.review_status === 'Rejected') row.rejected += 1;
        groups.set(office, row);
        return groups;
    }, new Map()).values()].sort((a, b) => a.office.localeCompare(b.office));
    const progressByPlan = approvedPlans.map(plan => ({ plan, objectives: filteredObjectives.filter(item => String(item.strategic_plan_id) === String(plan.record_id)) }));
    const missingLinks = filteredObjectives.filter(objective => !isAligned(objective));
    const myActions = reviews.filter(review => isSubmissionAssignedToReviewer(review, session));

    // Six-year chart: approved plans in the selected period (or the earliest period in scope).
    const period = chartPeriod(approvedPlans, scope);
    const chartPlans = approvedPlans.filter(plan => planPeriodKey(plan) === period.value);
    const chartPlanIds = chartPlans.map(plan => String(plan.record_id)).sort().join(',');
    const timelineSource = useManagementSource(
        () => Promise.all(chartPlanIds.split(',').map(getManagementProgressTimeline)).then(rows => rows.flatMap(row => row?.updates || [])),
        { enabled: canViewObjectives && Boolean(chartPlanIds), deps: [chartPlanIds, refresh] });
    const chartObjectives = executionObjectives.filter(objective => chartPlans.some(plan => String(plan.record_id) === String(objective.strategic_plan_id)));
    const sixYears = sixYearProgress({ period: period.value, objectives: chartObjectives, updates: timelineSource.data, plansById: approvedPlansById });

    const reportRows = {
        plans: filteredPlans.map(plan => ({ plan_id: plan.record_id, plan: plan.title, status: plan.planning_status_label || plan.status, approval_status: plan.approval_status || 'not_submitted', office: plan.department_agency || '', planning_start_date: plan.planning_start_date, planning_end_date: plan.planning_end_date })),
        progress: executionObjectives.map(item => ({ plan: item.strategic_plan?.title || '', objective: item.objective_title, responsible_office: officeName(item), progress_percent: progressPercent(item), status: statusLabels[progressStatus(item)], updated_at: item.progress_updated_at || '' })),
        alignment: filteredObjectives.map(item => ({ plan: item.strategic_plan?.title || '', presidential_agenda: agendaLabel(item), pdp_chapter: chapterLabel(item), objective: item.objective_title, agency: officeName(item) })),
        reviews: filteredReviews.map(item => ({ plan_id: item.planId, plan: item.plan_snapshot?.title || `Strategic Plan ${item.planId}`, stage: item.currentStage?.name || '', submitted_at: item.submittedAt || '', workflow: item.workflowName || '' })),
        inputs: filteredInputs.map(item => ({ plan: item.strategic_plan?.title || '', objective: item.objective?.objective_title || '', office: item.responsible_office_agency || '', input_type: item.input_type, category: item.feedback_category || item.input_type, status: item.review_status === 'Approved' ? 'Accepted' : item.review_status === 'Rejected' ? 'Declined' : item.review_status, submitted_at: item.submitted_at || '', content: item.content || '', reviewer_remarks: item.review_note || '', reviewed_at: item.reviewed_at || '' })),
        offices: performanceRows,
        risks: riskRows.map(({ objective, plan, risk }) => ({ plan: plan?.title || '', objective: objective.objective_title || '', office: officeName(objective), progress_percent: progressPercent(objective), planning_end_date: plan?.planning_end_date || '', risk })),
        approvals: filteredPlans.filter(plan => ['under_approval', 'approved', 'rejected'].includes(plan.approval_status)).map(plan => ({ plan_id: plan.record_id, plan: plan.title, approval_status: plan.approval_status, decision_display: plan.approval_status === 'rejected' ? 'Returned for correction' : plan.approval_status, office: plan.department_agency || '' })),
        consolidation: consolidationRows,
        breakdown: sixYears.years.map(row => ({ year: row.label, calendar_year: row.year, completed: row.future ? '' : row.completed, ongoing: row.future ? '' : row.ongoing, not_started: row.future ? '' : row.not_started, delayed: row.future ? '' : row.delayed, total: row.future ? 'Not yet reached' : row.total })),
    };

    // KPI row
    const planStatusCounts = [...filteredPlans.reduce((counts, plan) => {
        const label = plan.planning_status_label || plan.status || 'Unknown';
        return counts.set(label, (counts.get(label) || 0) + 1);
    }, new Map()).entries()].sort((a, b) => b[1] - a[1]);
    const reviewedInputs = inputCounts.approved + inputCounts.rejected;
    const kpis = [
        { label: 'Strategic Plans', state: sourceState(plansSource), retry: plansSource.retry, value: filteredPlans.length, detail: 'In your authorised scope', icon: 'bi-file-earmark-text-fill', tone: 'blue',
            extra: planStatusCounts.length ? h('details', { className: 'management-kpi__details' }, h('summary', null, 'By status'),
                h('ul', null, planStatusCounts.map(([label, count]) => h('li', { key: label }, h('span', null, label), h('strong', null, count))))) : null },
        { label: 'Objective Progress', state: sourceState(plansSource, objectivesSource), retry: () => { plansSource.retry(); objectivesSource.retry(); }, value: `${completed} / ${executionObjectives.length}`, detail: `Completed · ${ongoing} ongoing`, icon: 'bi-bar-chart-line-fill', tone: 'green', forbidden: 'Requires objective access' },
        { label: 'Alignment Coverage', state: sourceState(plansSource, objectivesSource), retry: () => { plansSource.retry(); objectivesSource.retry(); }, value: `${alignmentCoverage}%`, detail: `${alignedCount} of ${filteredObjectives.length} linked to Agenda and PDP`, icon: 'bi-bullseye', tone: 'purple', forbidden: 'Requires objective access' },
        { label: 'Inputs & Consolidation', state: sourceState(plansSource, inputsSource), retry: inputsSource.retry, value: filteredInputs.length ? `${Math.round(reviewedInputs * 100 / filteredInputs.length)}%` : '0%', detail: `Reviewed · ${inputCounts.pending} pending`, icon: 'bi-inboxes-fill', tone: 'cyan', forbidden: 'Requires input view permission' },
        { label: 'Awaiting Approval', state: sourceState(plansSource), retry: plansSource.retry, value: pendingPlans.length, detail: 'Plans under approval', icon: 'bi-hourglass-split', tone: 'amber' },
        { label: 'Overdue / Delayed', state: sourceState(plansSource, objectivesSource), retry: () => { plansSource.retry(); objectivesSource.retry(); }, value: riskRows.length, detail: 'Incomplete after plan end date', icon: 'bi-exclamation-triangle-fill', tone: 'red', forbidden: 'Requires objective access' },
    ];

    const emptyOrFiltered = message => h(EmptyState, { filtered, onClear: resetFilters, message });

    // Overview
    const chartGate = sectionGate([{ label: 'Strategic plans', source: plansSource }, { label: 'Objectives', source: objectivesSource }], { lines: 6 });
    const timelineGate = chartGate || (!chartPlans.length ? null : sectionGate([{ label: 'Progress history', source: timelineSource }], { lines: 6 }));
    const chartBody = timelineGate || (!chartPlans.length ? emptyOrFiltered('No approved plans in your authorised scope.') : h(SixYearChart, { years: sixYears.years, period: period.value }));
    const chartNote = period.value ? [`Objective status at the end of each plan year, ${periodLabel(period.value)} (Year 1 = ${period.value.split('-')[0]}).`,
        period.defaulted ? ' Showing the earliest planning period in scope; choose a planning period to change it.' : '',
        sixYears.truncated ? ' Only the first six years are shown.' : ''].join('') : 'Objective status at the end of each plan year.';
    const overviewContent = h(React.Fragment, null,
        h('div', { className: 'management-overview-grid' },
            h(SectionCard, { title: 'Six-Year Implementation Progress', description: chartNote, className: 'management-six-year' }, chartBody),
            h(SectionCard, { title: 'Progress Breakdown', description: 'Objectives counted per plan year. Future years are not yet reached.' },
                timelineGate || (!chartPlans.length ? emptyOrFiltered('No approved plans in your authorised scope.') : h(ProgressBreakdownTable, { years: sixYears.years })))),
        h(SectionCard, { title: 'Plan & Objective Progress', description: 'Status distribution per approved plan. Overdue / Delayed means unfinished after the plan end date.', className: 'management-objective-progress' },
            chartGate || (!progressByPlan.length ? emptyOrFiltered('No approved plans in your authorised scope.') : h(PlanProgressMonitor, { items: progressByPlan }))),
        h(SectionCard, { title: 'Office / Unit Performance', description: 'Objectives in approved plans, grouped by responsible Office / Unit.' },
            chartGate || (!officeRows.length ? emptyOrFiltered() : h(OfficePerformanceTable, { rows: officeRows, showInputs: inputsSource.status === 'ready', compact: true }))),
        h('div', { className: 'management-overview-grid management-overview-grid--split' },
            h(SectionCard, { title: 'Attention Required', description: 'Items that need follow-up within the current filters.' },
                chartGate || sectionGate([{ label: 'Agency inputs', source: inputsSource }].filter(item => item.source.status !== 'forbidden')) || h(AttentionRequired, {
                    overdue: riskRows, missingLinks, pendingInputs: filteredInputs.filter(input => input.review_status === 'Pending Review'), inputsState: inputsSource.status,
                    onShowOverdue: () => setFilter('status', 'objective:overdue'), onOpenTab: openTab })),
            h(SectionCard, { title: 'My Pending Actions', description: 'Plan approvals assigned to you at the current stage. Not affected by filters.' },
                sectionGate([{ label: 'Assigned reviews', source: reviewsSource }], { forbidden: 'You do not have permission to review strategic plans.' }) || h(PendingActions, { actions: myActions }))));

    // Alignment & Performance
    const alignmentGate = sectionGate([{ label: 'Strategic plans', source: plansSource }, { label: 'Objectives', source: objectivesSource }], { lines: 6 });
    const activeAgencies = new Set(filteredObjectives.map(officeName).filter(name => name !== 'Unassigned')).size;
    const alignmentContent = h(React.Fragment, null,
        h(SectionCard, { title: 'Alignment Monitoring', className: 'management-table-card', description: h(React.Fragment, null,
            h('span', { className: 'management-chain' }, ['Presidential Agenda', 'PDP Chapter', 'DOST Strategic Objective', 'Agency Plan'].map((step, index) => h(React.Fragment, { key: step }, index ? h('i', { className: 'bi bi-arrow-right', 'aria-label': 'then' }) : null, h('span', null, step)))),
            ' Agenda and PDP are separate objective links; a row lists both but does not certify a specific Agenda → PDP pair.') },
            alignmentGate || (!filteredObjectives.length ? emptyOrFiltered() : h(React.Fragment, null,
                h('div', { className: 'management-table-scroll' }, h('table', null,
                    h('thead', null, h('tr', null, ['Strategic Objective', 'PDP Chapter', 'Presidential Agenda', 'Agency', 'Status', 'Missing links'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                    h('tbody', null, pageRows(filteredObjectives, alignmentPage).map(item => {
                        const plan = plansById.get(String(item.strategic_plan_id));
                        const agenda = agendaLabel(item);
                        const chapter = chapterLabel(item);
                        return h('tr', { key: item.objective_id },
                            h('td', null, h('strong', null, item.objective_title || `Objective ${item.objective_id}`), h('p', null, plan?.title || '—')),
                            h('td', null, chapter), h('td', null, agenda), h('td', null, officeName(item)),
                            h('td', null, statusPill(objectiveRisk(item, plan) === 'Overdue' ? 'overdue' : progressStatus(item))),
                            h('td', null, [agenda === '—' && 'Agenda', chapter === '—' && 'PDP'].filter(Boolean).join(', ') || 'None'));
                    })))),
                h(ManagementPagination, { page: alignmentPage, total: filteredObjectives.length, label: 'objectives', onChange: setAlignmentPage })))),
        h(SectionCard, { title: 'Alignment Summary', description: 'Within the current filters.' },
            alignmentGate || h('div', { className: 'management-summary-cards' },
                h('article', null, h('span', { className: 'management-kpi__icon' }, h('i', { className: 'bi bi-diagram-3', 'aria-hidden': true })),
                    h('div', null, h('small', null, 'Mapped Objectives'), h('strong', null, `${alignedCount} of ${filteredObjectives.length}`),
                        h('div', { className: 'management-objective-meter progress-tone-completed', role: 'progressbar', 'aria-label': 'Alignment coverage', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': alignmentCoverage },
                            h('span', { style: { width: `${alignmentCoverage}%` } })),
                        h('span', null, `${alignmentCoverage}% linked to both Agenda and PDP`))),
                h('article', null, h('span', { className: 'management-kpi__icon' }, h('i', { className: 'bi bi-building', 'aria-hidden': true })),
                    h('div', null, h('small', null, 'Active Agencies'), h('strong', null, activeAgencies), h('span', null, 'Offices / Units responsible for at least one objective'))))),
        h(SectionCard, { title: 'Office / Unit Performance', description: 'Objectives in approved plans: completion, alignment coverage, agency inputs and overdue items.' },
            alignmentGate || (!officeRows.length ? emptyOrFiltered() : h(OfficePerformanceTable, { rows: officeRows, showInputs: inputsSource.status === 'ready' }))));

    // Inputs & Consolidation (read-only)
    const categoryLabels = { new_objective: 'Proposed objective', plan_feedback: 'Plan comment', objective_feedback: 'Objective comment', mapping_feedback: 'Mapping feedback' };
    const inputLabel = input => categoryLabels[input.feedback_category] || input.input_type?.replaceAll('_', ' ') || 'Input';
    const inputStatusLabel = status => status === 'Approved' ? 'Accepted' : status === 'Rejected' ? 'Declined' : status;
    const visibleInputs = filteredInputs.filter(input => (!inputStatus || input.review_status === inputStatus) && (!inputCategory || input.feedback_category === inputCategory));
    const inputsGate = sectionGate([{ label: 'Strategic plans', source: plansSource }, { label: 'Agency inputs', source: inputsSource }], { lines: 6, forbidden: 'You do not have permission to view submitted inputs.' });
    const inputsContent = h(React.Fragment, null,
        h(SectionCard, { title: 'Input Review', className: 'management-table-card', description: 'Office / Agency suggestions, comments and review outcomes. Acceptance does not automatically merge a suggestion into the plan.',
            actions: inputsGate ? null : h(React.Fragment, null,
                h('label', { className: 'management-approvals__search' }, h('span', null, 'Review status'), h('select', { value: inputStatus, onChange: event => { setInputStatus(event.target.value); setAgencyPage(1); } },
                    h('option', { value: '' }, 'All statuses'), ['Pending Review', 'Approved', 'Rejected'].map(value => h('option', { key: value, value }, inputStatusLabel(value))))),
                h('label', { className: 'management-approvals__search' }, h('span', null, 'Category'), h('select', { value: inputCategory, onChange: event => { setInputCategory(event.target.value); setAgencyPage(1); } },
                    h('option', { value: '' }, 'All categories'), Object.entries(categoryLabels).map(([value, label]) => h('option', { key: value, value }, label))))) },
            inputsGate || (!filteredInputs.length ? emptyOrFiltered() : h(React.Fragment, null,
                h('div', { className: 'management-table-scroll' }, h('table', null,
                    h('thead', null, h('tr', null, ['Office / Agency', 'Plan / Related item', 'Category', 'Review status', 'Submitted', 'Details'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                    h('tbody', null, visibleInputs.length ? pageRows(visibleInputs, agencyPage).map(input => h('tr', { key: input.input_id },
                        h('td', null, input.responsible_office_agency || '—'),
                        h('td', null, input.strategic_plan?.title || '—', h('p', null, input.objective?.objective_title || input.mapping_reference_title || 'Plan-level input')),
                        h('td', null, inputLabel(input)), h('td', null, inputStatusLabel(input.review_status)), h('td', null, managementDateLabel(input.submitted_at)),
                        h('td', null, h('details', null, h('summary', null, 'View'), h('p', null, input.content || '—'),
                            input.mapping_reference_title && h('p', null, `Mapping: ${input.mapping_reference_title}`),
                            h('p', null, `Submitted by: ${input.submitter_name || '—'}`),
                            h('p', null, `Reviewer remarks: ${input.review_note || 'Not reviewed yet'}`),
                            input.reviewed_at && h('p', null, `${input.reviewer_name || 'Reviewer'} · ${managementDateLabel(input.reviewed_at)}`)))))
                        : h('tr', null, h('td', { colSpan: 6 }, 'No inputs match this status or category.'))))),
                h(ManagementPagination, { page: agencyPage, total: visibleInputs.length, label: 'inputs', onChange: setAgencyPage })))),
        h(SectionCard, { title: 'Consolidation by Office / Unit', className: 'management-table-card', description: 'Pending, accepted and declined agency inputs per office.' },
            inputsGate || (!consolidationRows.length ? emptyOrFiltered() : h('div', { className: 'management-table-scroll' }, h('table', null,
                h('thead', null, h('tr', null, ['Office / Unit', 'Total', 'Pending review', 'Accepted', 'Declined', 'Reviewed'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                h('tbody', null, consolidationRows.map(row => h('tr', { key: row.office },
                    h('th', { scope: 'row' }, row.office), h('td', null, row.total), h('td', null, row.pending), h('td', null, row.approved), h('td', null, row.rejected),
                    h('td', null, `${row.total ? Math.round((row.approved + row.rejected) * 100 / row.total) : 0}%`)))))))));

    // Reviews & Approvals
    const allPlanIds = new Set(plans.map(plan => String(plan.record_id)));
    const approvalPlans = mergeAssignedPlans(plans, reviews).filter(plan => allowedPlanIds.has(String(plan.record_id))
        || (!allPlanIds.has(String(plan.record_id)) && planMatchesFilters(plan, scope) && (!scope.office || plan.department_agency === scope.office)));
    const approvalsGate = sectionGate([{ label: 'Strategic plans', source: plansSource }], { lines: 6 });
    const reviewsGate = reviewsSource.status === 'error' ? sectionGate([{ label: 'Assigned reviews', source: reviewsSource }]) : null;
    const approvalsContent = h(React.Fragment, null,
        reviewsGate,
        approvalsGate ? h(SectionCard, { title: 'Reviews & Approvals' }, approvalsGate)
            : h(ApprovalsPanel, { session, management: true, plans: approvalPlans, assigned: reviews, loading: reviewsSource.status === 'loading', section: queue,
                onSectionChange: id => navigate({ queue: id }), emptyMessage: filtered ? 'No plans in this category match the current filters.' : 'No plans in this category.' }));

    // Reports & Summary (unchanged report list)
    const sources = [plansSource, objectivesSource, reviewsSource, inputsSource];
    const loading = sources.some(source => source.status === 'loading');
    const hasErrors = sources.some(source => source.status === 'error');
    const reports = [
        { id: 'plans', title: 'Strategic Plan Register', description: 'Plan title, lifecycle status and planning period.', icon: 'bi-journal-text', count: filteredPlans.length, label: 'plans', rows: reportRows.plans },
        { id: 'progress', title: 'Objective Progress Summary', description: 'Progress percentage, calculated status, responsible office and last update.', icon: 'bi-graph-up', count: executionObjectives.length, label: 'objectives', rows: reportRows.progress },
        { id: 'alignment', title: 'Strategic Alignment Report', description: 'Agenda, PDP chapter, objective and responsible agency mappings.', icon: 'bi-diagram-3', count: filteredObjectives.length, label: 'objective mappings', rows: reportRows.alignment },
        { id: 'inputs', title: 'Agency Input Report', description: 'Submitted agency implementation updates, review status and submission date.', icon: 'bi-building-check', count: filteredInputs.length, label: 'agency inputs', rows: reportRows.inputs },
        { id: 'reviews', title: 'Assigned Approval Queue', description: 'Plan approvals assigned to your account and their current workflow stage.', icon: 'bi-clipboard-check', count: filteredReviews.length, label: 'pending reviews', rows: reportRows.reviews },
        { id: 'approvals', title: 'Plan Approval Status', description: 'Awaiting, approved and returned plans.', icon: 'bi-clipboard-check', count: reportRows.approvals.length, label: 'plans', rows: reportRows.approvals },
        { id: 'offices', title: 'Office / Unit Performance', description: 'Objective execution counts by responsible Office / Agency.', icon: 'bi-people', count: performanceRows.length, label: 'offices', rows: reportRows.offices },
        { id: 'risks', title: 'Overdue Items', description: 'Incomplete objectives past their plan end date. The plan end date is used because objective deadlines are not available.', icon: 'bi-exclamation-triangle', count: riskRows.length, label: 'items', rows: reportRows.risks },
        { id: 'consolidation', title: 'Input Consolidation Progress', description: 'Pending, approved and rejected agency inputs by office.', icon: 'bi-inboxes', count: consolidationRows.length, label: 'offices', rows: reportRows.consolidation },
    ];
    const visibleReports = reports.filter(report => !['inputs', 'consolidation'].includes(report.id) || canViewInputs);
    const selectedReport = visibleReports.find(report => report.id === activeReport);
    const reportsContent = h(React.Fragment, null,
        h('section', { className: 'management-oversight', 'aria-label': 'Management status overview' },
            h('article', null, h('h2', null, 'Plan approvals'), h('p', null, `${pendingPlans.length} awaiting · ${approvedPlans.length} approved · ${returnedPlans.length} returned for correction`)),
            h('article', null, h('h2', null, 'Office performance'), h('p', null, `${performanceRows.length} office(s) · ${filteredObjectives.length} assigned objective(s)`)),
            canViewInputs ? h('article', null, h('h2', null, 'Input consolidation'), h('p', null, `${inputCounts.pending} pending · ${inputCounts.approved} approved · ${inputCounts.rejected} rejected`)) : null,
            h('article', null, h('h2', null, 'Overdue objectives'), h('p', null, `${riskRows.length} overdue`))),
        h('section', { className: 'management-card management-table-card', 'aria-label': 'Reports and summaries' },
            h('div', { className: 'management-card__heading' }, h('div', null,
                h('h2', null, selectedReport ? selectedReport.title : 'Reports & Summary'),
                h('p', null, selectedReport ? selectedReport.description : 'Browse reporting datasets, inspect records and export CSV files.')),
                selectedReport ? h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => { setActiveReport(''); setReportPage(1); } }, 'Back to reports') : null),
            selectedReport
                ? h(React.Fragment, null,
                    h('div', { className: 'management-report-detail__actions' }, h('span', null, `${selectedReport.rows.length} ${selectedReport.label}`),
                        h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', disabled: loading || hasErrors || !selectedReport.rows.length, onClick: () => downloadCsv(`${selectedReport.id}-report.csv`, selectedReport.rows) }, 'Export CSV')),
                    h('div', { className: 'management-table-scroll' }, h('table', null,
                        h('thead', null, h('tr', null, (selectedReport.rows.length ? Object.keys(selectedReport.rows[0]) : ['No records']).map(key => h('th', { key, scope: 'col' }, key.replaceAll('_', ' '))))),
                        h('tbody', null, selectedReport.rows.length ? pageRows(selectedReport.rows, reportPage).map((row, index) => h('tr', { key: `${reportPage}-${index}` }, Object.keys(row).map(key => h('td', { key }, String(row[key] ?? '—'))))) : h('tr', null, h('td', null, 'No records available.'))))),
                    h(ManagementPagination, { page: reportPage, total: selectedReport.rows.length, label: 'records', onChange: setReportPage }))
                : h('div', { className: 'management-report-list' }, visibleReports.map(report => h('article', { className: 'management-report-list__row', key: report.id },
                    h('span', { className: 'management-report-card__icon' }, h('i', { className: `bi ${report.icon}`, 'aria-hidden': true })),
                    h('div', { className: 'management-report-list__copy' }, h('h3', null, report.title), h('p', null, report.description), h('small', null, `${loading ? '—' : report.count} ${report.label}`)),
                    h('div', { className: 'management-report-card__actions' },
                        h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: loading, onClick: () => { setActiveReport(report.id); setReportPage(1); } }, 'View'),
                        h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', disabled: loading || hasErrors || !report.rows.length, onClick: () => downloadCsv(`${report.id}-report.csv`, report.rows) }, 'Export CSV')))))));

    // Export Dashboard: the current tab's main dataset.
    const exportSets = {
        overview: { rows: reportRows.breakdown, name: `six-year-progress-${period.value || 'all'}.csv`, sources: [plansSource, objectivesSource, ...(chartPlanIds ? [timelineSource] : [])] },
        alignment: { rows: reportRows.alignment, name: 'alignment-monitoring.csv', sources: [plansSource, objectivesSource] },
        inputs: { rows: reportRows.inputs, name: 'inputs-consolidation.csv', sources: [plansSource, inputsSource] },
        approvals: { rows: reportRows.approvals, name: 'reviews-approvals.csv', sources: [plansSource] },
    };
    const exportSet = exportSets[activeTab];
    const exportDisabled = !exportSet || exportSet.sources.some(source => source.status !== 'ready') || !exportSet.rows.length
        || (activeTab === 'overview' && !chartPlans.length);

    const pageContent = { overview: overviewContent, alignment: alignmentContent, inputs: inputsContent, approvals: approvalsContent, reports: reportsContent }[activeTab];
    const activeLabel = TABS.find(tab => tab.id === activeTab).label;

    return h('div', { className: 'app-shell management-dashboard' },
        h(AppSidebar),
        h('main', { className: 'app-shell-main' }, h('div', { className: 'management-dashboard__content' },
            h('header', { className: 'management-dashboard__header' },
                h('div', null, h('h1', null, 'Management Dashboard'),
                    h('p', null, 'Monitor strategic plan progress, alignment status, and planning summaries across departments and agencies.')),
                h('div', { className: 'management-dashboard__controls' },
                    h(PlanningPeriodSelect, { filters, plans, onChange: setFilter, disabled: plansSource.status !== 'ready' }),
                    h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setRefresh(value => value + 1), disabled: loading, 'aria-label': 'Refresh dashboard data', title: 'Refresh dashboard data' }, h('i', { className: 'bi bi-arrow-clockwise', 'aria-hidden': true })),
                    activeTab !== 'reports' ? h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', disabled: exportDisabled, onClick: () => downloadCsv(exportSet.name, exportSet.rows),
                        title: `Export the ${activeLabel} data as CSV` }, h('i', { className: 'bi bi-download', 'aria-hidden': true }), ' Export Dashboard') : null)),
            h('section', { className: 'management-kpis', 'aria-label': 'Strategic planning summary' }, kpis.map(card => h(KpiCard, { key: card.label, card }))),
            h(ManagementFilterBar, { filters, plans, offices, onChange: setFilter, onReset: resetFilters, includePeriod: false, disabled: plansSource.status !== 'ready' }),
            h('nav', { className: 'management-dashboard__tabs', 'aria-label': 'Dashboard sections' }, visibleTabs.map(tab => h('button', {
                key: tab.id, type: 'button', className: `management-dashboard__tab${activeTab === tab.id ? ' is-active' : ''}`,
                'aria-current': activeTab === tab.id ? 'page' : undefined, onClick: () => openTab(tab.id),
            }, tab.label))),
            h('section', { className: 'management-dashboard__panel', 'aria-label': activeLabel }, pageContent),
            h('footer', { className: 'management-dashboard__footer' }, '© 2026 Strategic Planning Management System. All rights reserved.'))));
}

const root = createPageRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading Management access…'));
apiRequest('/api/auth/me').then(payload => {
    const session = saveAccessSession(createAccessSession(payload.data));
    if (!enforcePageAccess()) return;
    if (!isManagementSession(session)) { window.location.replace('/access-denied'); return; }
    root.render(h(ManagementErrorBoundary, null, h(ManagementDashboard, { session })));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
