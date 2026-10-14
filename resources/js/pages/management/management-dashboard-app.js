import { createPageRoot } from '../../navigation/page-root.js';
import { usePageQuery } from '../../navigation/use-page-query.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { apiRequest } from '../../api/api-client.js';
import { listAllStrategicObjectives } from '../../api/strategic-objectives-api.js';
import { listAssignedPlanSubmissions } from '../../api/plan-approval-api.js';
import { listSubmittedInputs } from '../../api/implementation-inputs-api.js';
import { createAccessSession, saveAccessSession, can } from '../../access/access-session.js';
import { PERMISSIONS as P } from '../../access/access-policy.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { isManagementSession } from '../../access/management-access.js';
import { ManagementPagination, pageRows } from '../../components/ManagementPagination.js';
import { filterManagementRows, officeName, officePerformance, objectiveRisk, planningYears, progressPercent, progressStatus } from './management-insights.js';
import { listAuthorizedManagementPlans, loadAllManagementPages, managementDateLabel } from './management-data.js';

const h = React.createElement;
const statusLabels = { completed: 'Completed', in_progress: 'Ongoing', not_started: 'Not Started' };

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
    const url = URL.createObjectURL(new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function ManagementDashboard({ session }) {
    const pageQuery = usePageQuery();
    const canViewInputs = can(P.INPUTS_VIEW, session) || can('implementation_inputs.view_all', session);
    const queryTab = new URLSearchParams(pageQuery).get('tab');
    const activeTab = queryTab === 'inputs' || (queryTab === 'alignment' && new URLSearchParams(pageQuery).get('section') === 'agency') ? 'inputs' : queryTab === 'alignment' ? 'alignment' : queryTab === 'reports' ? 'reports' : 'dashboard';
    const [scopeFilters, setScopeFilters] = React.useState({ planId: '', year: '', office: '', planStatus: '', objectiveStatus: '', approvalStatus: '' });
    const [planSearch, setPlanSearch] = React.useState('');
    const [inputStatus, setInputStatus] = React.useState('');
    const [inputCategory, setInputCategory] = React.useState('');
    const [selectedPlanId, setSelectedPlanId] = React.useState('');
    const [activeReport, setActiveReport] = React.useState('');
    const [planPage, setPlanPage] = React.useState(1);
    const [monitorObjectivePage, setMonitorObjectivePage] = React.useState(1);
    const [alignmentPage, setAlignmentPage] = React.useState(1);
    const [agencyPage, setAgencyPage] = React.useState(1);
    const [reportPage, setReportPage] = React.useState(1);
    const [plans, setPlans] = React.useState([]);
    const [objectives, setObjectives] = React.useState([]);
    const [reviews, setReviews] = React.useState([]);
    const [inputs, setInputs] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshCount, setRefreshCount] = React.useState(0);
    const [errors, setErrors] = React.useState([]);

    React.useEffect(() => {
        let active = true;
        async function load() {
            setLoading(true);
            setErrors([]);
            const results = await Promise.allSettled([
                listAuthorizedManagementPlans(),
                can('strategic_objectives.view', session) ? loadAllManagementPages(listAllStrategicObjectives) : Promise.resolve([]),
                can(P.PLANS_VIEW, session) ? listAssignedPlanSubmissions() : Promise.resolve([]),
                canViewInputs ? loadAllManagementPages(listSubmittedInputs) : Promise.resolve([]),
            ]);
            if (!active) return;
            const nextErrors = [];
            if (results[0].status === 'fulfilled') setPlans(results[0].value);
            else { setPlans([]); nextErrors.push(`Strategic plans: ${results[0].reason.message}`); }
            if (results[1].status === 'fulfilled') setObjectives(results[1].value);
            else { setObjectives([]); nextErrors.push(`Objectives: ${results[1].reason.message}`); }
            if (results[2].status === 'fulfilled') setReviews(results[2].value);
            else { setReviews([]); nextErrors.push(`Assigned reviews: ${results[2].reason.message}`); }
            if (results[3].status === 'fulfilled') setInputs(results[3].value);
            else { setInputs([]); nextErrors.push(`Agency inputs: ${results[3].reason.message}`); }
            setErrors(nextErrors);
            setLoading(false);
        }
        load();
        return () => { active = false; };
    }, [refreshCount, session, canViewInputs]);

    React.useEffect(() => {
        setScopeFilters({ planId: '', year: '', office: '', planStatus: '', objectiveStatus: '', approvalStatus: '' });
        setPlanPage(1); setMonitorObjectivePage(1); setAlignmentPage(1); setAgencyPage(1); setReportPage(1);
        setSelectedPlanId(''); setActiveReport(''); setPlanSearch(''); setInputStatus(''); setInputCategory('');
    }, [activeTab]);

    const activePlans = activeTab === 'dashboard' ? plans.filter(plan => plan.approval_status === 'approved') : plans;
    const currentObjectives = objectives.filter(objective => !['archived', 'deleted'].includes(objective.status));
    const scoped = filterManagementRows(activePlans, currentObjectives, scopeFilters, inputs);
    const filteredPlans = scoped.plans;
    const filteredObjectives = scoped.objectives;
    const agencies = [...new Set([...objectives.map(officeName), ...inputs.map(input => input.responsible_office_agency), ...plans.map(plan => plan.department_agency)].filter(Boolean))].sort();
    const allowedPlanIds = new Set(filteredPlans.map(plan => String(plan.record_id)));
    const allowedObjectiveIds = new Set(filteredObjectives.map(objective => String(objective.objective_id)));
    const filteredInputs = inputs.filter(input => allowedPlanIds.has(String(input.strategic_plan_id))
        && (!scopeFilters.office || input.responsible_office_agency === scopeFilters.office)
        && (!scopeFilters.objectiveStatus || allowedObjectiveIds.has(String(input.objective_id))));
    const filteredReviews = reviews.filter(review => allowedPlanIds.has(String(review.planId)));
    const executionObjectives = filteredObjectives.filter(objective => filteredPlans.some(plan => String(plan.record_id) === String(objective.strategic_plan_id) && plan.approval_status === 'approved'));
    const completed = executionObjectives.filter(item => progressStatus(item) === 'completed').length;
    const ongoing = executionObjectives.filter(item => progressStatus(item) === 'in_progress').length;
    const alignedCount = filteredObjectives.filter(item => (item.presidential_agenda_items || []).length && (item.pdp_chapters || []).length).length;
    const alignmentCoverage = filteredObjectives.length ? Math.round(alignedCount * 100 / filteredObjectives.length) : 0;
    const plansById = new Map(filteredPlans.map(plan => [String(plan.record_id), plan]));
    const delayed = filteredObjectives.filter(objective => plansById.get(String(objective.strategic_plan_id))?.approval_status === 'approved' && objectiveRisk(objective, plansById.get(String(objective.strategic_plan_id))) === 'Overdue').length;
    const pendingPlans = filteredPlans.filter(plan => plan.approval_status === 'under_approval');
    const approvedPlans = filteredPlans.filter(plan => plan.approval_status === 'approved');
    const returnedPlans = filteredPlans.filter(plan => plan.approval_status === 'rejected');
    const riskRows = filteredObjectives.filter(objective => plansById.get(String(objective.strategic_plan_id))?.approval_status === 'approved').map(objective => ({ objective, plan: plansById.get(String(objective.strategic_plan_id)) }))
        .map(row => ({ ...row, risk: objectiveRisk(row.objective, row.plan) })).filter(row => row.risk);
    const performanceRows = officePerformance(executionObjectives);
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

    const progressByPlan = filteredPlans.map(plan => {
        const planObjectives = filteredObjectives.filter(item => String(item.strategic_plan_id) === String(plan.record_id));
        const counts = { completed: 0, in_progress: 0, not_started: 0 };
        planObjectives.forEach(item => { counts[progressStatus(item)] += 1; });
        return { plan, objectives: planObjectives, counts };
    });
    const monitoringPlans = progressByPlan.filter(item => !planSearch.trim()
        || `${item.plan.record_id} ${item.plan.title || ''} ${item.plan.department_agency || ''}`.toLowerCase().includes(planSearch.trim().toLowerCase()));
    const monitoringSummary = monitoringPlans.reduce((summary, item) => {
        summary.plans += 1;
        summary.objectives += item.objectives.length;
        item.objectives.forEach(objective => {
            const state = objectiveRisk(objective, item.plan) === 'Overdue' ? 'overdue' : progressStatus(objective);
            summary[state] += 1;
        });
        return summary;
    }, { plans: 0, objectives: 0, completed: 0, in_progress: 0, not_started: 0, overdue: 0 });

    const reportRows = {
        plans: filteredPlans.map(plan => ({ plan_id: plan.record_id, plan: plan.title, status: plan.planning_status_label || plan.status, approval_status: plan.approval_status || 'not_submitted', office: plan.department_agency || '', planning_start_date: plan.planning_start_date, planning_end_date: plan.planning_end_date })),
        progress: executionObjectives.map(item => ({ plan: item.strategic_plan?.title || '', objective: item.objective_title, responsible_office: officeName(item), progress_percent: progressPercent(item), status: statusLabels[progressStatus(item)], updated_at: item.progress_updated_at || '' })),
        alignment: filteredObjectives.map(item => ({ plan: item.strategic_plan?.title || '', presidential_agenda: labelFor(item.presidential_agenda_items, ['title', 'item_title', 'agenda_title', 'name']), pdp_chapter: labelFor(item.pdp_chapters, ['chapter_title', 'title', 'name']), objective: item.objective_title, agency: officeName(item) })),
        reviews: filteredReviews.map(item => ({ plan_id: item.planId, plan: item.plan_snapshot?.title || `Strategic Plan ${item.planId}`, stage: item.currentStage?.name || '', submitted_at: item.submittedAt || '', workflow: item.workflowName || '' })),
        inputs: filteredInputs.map(item => ({ plan: item.strategic_plan?.title || '', objective: item.objective?.objective_title || '', office: item.responsible_office_agency || '', input_type: item.input_type, category: item.feedback_category || item.input_type, status: item.review_status === 'Approved' ? 'Accepted' : item.review_status === 'Rejected' ? 'Declined' : item.review_status, submitted_at: item.submitted_at || '', content: item.content || '', reviewer_remarks: item.review_note || '', reviewed_at: item.reviewed_at || '' })),
        offices: performanceRows,
        risks: riskRows.map(({ objective, plan, risk }) => ({ plan: plan?.title || '', objective: objective.objective_title || '', office: officeName(objective), progress_percent: progressPercent(objective), planning_end_date: plan?.planning_end_date || '', risk })),
        approvals: filteredPlans.filter(plan => ['under_approval', 'approved', 'rejected'].includes(plan.approval_status)).map(plan => ({ plan_id: plan.record_id, plan: plan.title, approval_status: plan.approval_status, decision_display: plan.approval_status === 'rejected' ? 'Returned for correction' : plan.approval_status, office: plan.department_agency || '' })),
        consolidation: consolidationRows,
    };

    const kpis = [
        { label: 'Total Strategic Plans', value: loading ? '—' : filteredPlans.length, detail: 'Across authorized agencies', icon: 'bi-file-earmark-text-fill', tone: 'blue' },
        { label: 'Ongoing Objectives', value: loading ? '—' : ongoing, detail: 'In progress', icon: 'bi-bar-chart-line-fill', tone: 'blue' },
        { label: 'Completed Objectives', value: loading ? '—' : completed, detail: 'On track', icon: 'bi-check-lg', tone: 'green' },
        { label: 'Delayed Objectives', value: loading ? '—' : delayed, detail: 'Incomplete after plan end date', icon: 'bi-hourglass-split', tone: 'red' },
        { label: 'Alignment Coverage', value: loading ? '—' : `${alignmentCoverage}%`, detail: 'Objectives linked to Agenda and PDP', icon: 'bi-bullseye', tone: 'purple' },
    ];

    const kpiCards = kpis.map(card => h('article', { className: `management-kpi is-${card.tone}`, key: card.label },
        h('span', { className: 'management-kpi__icon' }, h('i', { className: `bi ${card.icon}`, 'aria-hidden': 'true' })),
        h('span', { className: 'management-kpi__copy' }, h('small', null, card.label), h('strong', null, card.value), h('span', null, card.detail))));

    const progressLabels = { completed: 'Completed', in_progress: 'In Progress', not_started: 'Not Started', overdue: 'Overdue' };
    const dashboardContent = h('section', { className: 'management-card management-objective-progress' },
        h('div', { className: 'management-card__heading' }, h('div', null,
            h('h2', null, 'Strategic Objective Progress'),
            h('p', null, 'Implementation status across approved plans. The figures below update with the selected filters.'))),
        !loading && !errors.length && h('div', { className: 'management-monitor-summary', 'aria-label': 'Filtered monitoring summary' },
            [['Plans monitored', monitoringSummary.plans, 'plans'], ['Objectives tracked', monitoringSummary.objectives, 'objectives'], ['Completed', monitoringSummary.completed, 'completed'], ['Overdue', monitoringSummary.overdue, 'overdue']].map(([label, count, tone]) =>
                h('div', { className: `management-monitor-summary__item progress-tone-${tone}`, key: label }, h('span', null, label), h('strong', null, count)))),
        h('div', { className: 'management-progress-legend', 'aria-label': 'Objective status legend' }, Object.entries(progressLabels).map(([status, label]) =>
            h('span', { key: status, className: `progress-tone-${status}` }, h('i', { 'aria-hidden': true }), label))),
        h('details', { className: 'management-progress-guide' }, h('summary', null, 'How progress status is classified'),
            h('p', null, 'Not Started means 0%; In Progress means 1–99%; Completed means 100%. Overdue means an objective is unfinished after its plan end date.')),
        loading ? h('p', { role: 'status', className: 'management-empty' }, 'Loading objective progress…')
            : errors.length ? h('p', { role: 'alert', className: 'management-empty' }, 'Some data could not be loaded. Use Refresh to retry before reviewing progress.')
            : !monitoringPlans.length ? h('p', { className: 'management-empty' }, Object.values(scopeFilters).some(Boolean) || planSearch ? 'No approved plans match these filters.' : 'No approved plans are available for monitoring.')
            : h('div', { className: 'management-progress-plans' }, pageRows(monitoringPlans, planPage, 6).map(item => {
                const expanded = selectedPlanId === String(item.plan.record_id);
                const total = item.objectives.length;
                const stateCounts = { completed: 0, in_progress: 0, not_started: 0, overdue: 0 };
                item.objectives.forEach(objective => {
                    const state = objectiveRisk(objective, item.plan) === 'Overdue' ? 'overdue' : progressStatus(objective);
                    stateCounts[state] += 1;
                });
                return h('article', { key: item.plan.record_id, className: 'management-progress-plan' },
                    h('div', { className: 'management-progress-plan__heading' },
                        h('div', { className: 'management-progress-plan__copy' },
                            h('div', { className: 'management-progress-plan__meta' }, h('span', null, `Plan ${item.plan.record_id}`), item.plan.department_agency && h('span', null, item.plan.department_agency)),
                            h('h3', null, item.plan.title),
                            h('p', null, h('span', null, 'Planning period'), ' ', `${managementDateLabel(item.plan.planning_start_date)} – ${managementDateLabel(item.plan.planning_end_date)}`)),
                        h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', 'aria-expanded': expanded, 'aria-controls': `monitor-objectives-${item.plan.record_id}`,
                            onClick: () => { setSelectedPlanId(expanded ? '' : String(item.plan.record_id)); setMonitorObjectivePage(1); } }, expanded ? 'Hide objectives' : `View objectives (${total})`)),
                    h('div', { className: 'management-progress-plan__status' },
                        h('div', { className: 'management-progress-counts' },
                            ['completed', 'in_progress', 'not_started', 'overdue'].map(status => h('span', { className: `progress-tone-${status}`, key: status }, h('strong', null, stateCounts[status]), ` ${progressLabels[status]}`))),
                        total > 0 && h('div', { className: 'management-plan-status-bar', role: 'img', 'aria-label': `${stateCounts.completed} completed, ${stateCounts.in_progress} in progress, ${stateCounts.not_started} not started, ${stateCounts.overdue} overdue` },
                            ['completed', 'in_progress', 'not_started', 'overdue'].map(status => stateCounts[status] ? h('span', { key: status, className: `progress-tone-${status}`, style: { width: `${stateCounts[status] * 100 / total}%` } }) : null))),
                    expanded && h('div', { id: `monitor-objectives-${item.plan.record_id}`, className: 'management-objective-cards' },
                        !total ? h('p', { className: 'management-empty' }, 'No objectives match the current filters for this plan.') : pageRows(item.objectives, monitorObjectivePage, 6).map(objective => {
                            const percent = progressPercent(objective);
                            const status = objectiveRisk(objective, item.plan) === 'Overdue' ? 'overdue' : progressStatus(objective);
                            return h('article', { key: objective.objective_id, className: `management-objective-card progress-tone-${status}` },
                                h('div', { className: 'management-objective-card__heading' }, h('h4', null, objective.objective_title || `Objective ${objective.objective_id}`),
                                    h('span', { className: 'management-objective-badge' }, progressLabels[status])),
                                h('p', { className: 'management-objective-owner' }, h('i', { className: 'bi bi-building', 'aria-hidden': true }), ' Responsible Office / Unit: ', h('strong', null, officeName(objective))),
                                h('div', { className: 'management-objective-meter-label' }, h('span', null, 'Progress'), h('strong', null, `${percent}%`)),
                                h('div', { className: 'management-objective-meter', role: 'progressbar', 'aria-label': `${objective.objective_title || 'Objective'} progress`, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent, 'aria-valuetext': `${percent}% — ${progressLabels[status]}` },
                                    h('span', { style: { width: `${percent}%` } })),
                                h('small', { className: 'management-objective-updated' }, `Last updated: ${managementDateLabel(objective.progress_updated_at, 'No progress update yet')}`));
                        }),
                        total > 0 && h(ManagementPagination, { page: monitorObjectivePage, total, pageSize: 6, label: 'objectives', onChange: setMonitorObjectivePage })));
            })),
        !loading && !errors.length && h(ManagementPagination, { page: planPage, total: monitoringPlans.length, pageSize: 6, label: 'plans', onChange: next => { setPlanPage(next); setSelectedPlanId(''); } }));

    const alignmentMappingContent = h('section', { className: 'management-card management-table-card' },
        h('div', { className: 'management-card__heading' }, h('div', null,
            h('h2', null, 'Alignment Review'),
            h('p', null, `${alignedCount} of ${filteredObjectives.length} objectives linked to both Agenda and PDP. Responsible agencies indicate execution ownership; they are not additional mapping records.`))),
        h('div', { className: 'management-table-scroll' }, h('table', null,
            h('thead', null, h('tr', null, ['Presidential Agenda', 'PDP Chapter', 'DOST Plan / Objective', 'Responsible Office / Agency', 'Missing links'].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 5 }, 'Loading alignment…')) : filteredObjectives.length ? pageRows(filteredObjectives, alignmentPage).map(item => {
                const agenda = labelFor(item.presidential_agenda_items, ['title', 'item_title', 'agenda_title', 'name']);
                const chapter = labelFor(item.pdp_chapters, ['chapter_title', 'title', 'name']);
                return h('tr', { key: item.objective_id }, h('td', null, agenda), h('td', null, chapter),
                    h('td', null, h('strong', null, plansById.get(String(item.strategic_plan_id))?.title || '—'), h('p', null, item.objective_title)),
                    h('td', null, officeName(item)), h('td', null, [agenda === '—' && 'Agenda', chapter === '—' && 'PDP'].filter(Boolean).join(', ') || 'None'));
            }) : h('tr', null, h('td', { colSpan: 5 }, 'No objectives match these filters.'))))),
        h(ManagementPagination, { page: alignmentPage, total: filteredObjectives.length, label: 'objectives', onChange: setAlignmentPage }));

    const categoryLabels = { new_objective: 'Proposed objective', plan_feedback: 'Plan comment', objective_feedback: 'Objective comment', mapping_feedback: 'Mapping feedback' };
    const inputLabel = input => categoryLabels[input.feedback_category] || input.input_type?.replaceAll('_', ' ') || 'Input';
    const inputStatusLabel = status => status === 'Approved' ? 'Accepted' : status === 'Rejected' ? 'Declined' : status;
    const visibleInputs = filteredInputs.filter(input => (!inputStatus || input.review_status === inputStatus) && (!inputCategory || input.feedback_category === inputCategory));
    const inputsContent = !canViewInputs ? h('p', { role: 'alert' }, 'You do not have permission to view submitted inputs.') : h('section', { className: 'management-card management-table-card' },
        h('div', { className: 'management-card__heading' }, h('div', null, h('h2', null, 'Input Review'),
            h('p', null, 'Inspect Office / Agency suggestions, comments and review outcomes. Acceptance does not automatically merge a suggestion into the plan.'))),
        h('div', { className: 'management-scope-filters' },
            h('label', null, 'Review status', h('select', { value: inputStatus, onChange: event => { setInputStatus(event.target.value); setAgencyPage(1); } },
                h('option', { value: '' }, 'All statuses'), ['Pending Review', 'Approved', 'Rejected'].map(value => h('option', { key: value, value }, inputStatusLabel(value))))),
            h('label', null, 'Category', h('select', { value: inputCategory, onChange: event => { setInputCategory(event.target.value); setAgencyPage(1); } },
                h('option', { value: '' }, 'All categories'), Object.entries(categoryLabels).map(([value, label]) => h('option', { key: value, value }, label))))),
        h('div', { className: 'management-table-scroll' }, h('table', null,
            h('thead', null, h('tr', null, ['Office / Agency', 'Plan / Related item', 'Category', 'Review status', 'Submitted', 'Details'].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 6 }, 'Loading inputs…')) : visibleInputs.length ? pageRows(visibleInputs, agencyPage).map(input => h('tr', { key: input.input_id },
                h('td', null, input.responsible_office_agency || '—'),
                h('td', null, input.strategic_plan?.title || '—', h('p', null, input.objective?.objective_title || input.mapping_reference_title || 'Plan-level input')),
                h('td', null, inputLabel(input)), h('td', null, inputStatusLabel(input.review_status)), h('td', null, managementDateLabel(input.submitted_at)),
                h('td', null, h('details', null, h('summary', null, 'View'), h('p', null, input.content || '—'),
                    input.mapping_reference_title && h('p', null, `Mapping: ${input.mapping_reference_title}`),
                    h('p', null, `Submitted by: ${input.submitter_name || '—'}`),
                    h('p', null, `Reviewer remarks: ${input.review_note || 'Not reviewed yet'}`),
                    input.reviewed_at && h('p', null, `${input.reviewer_name || 'Reviewer'} · ${managementDateLabel(input.reviewed_at)}`)))))
                : h('tr', null, h('td', { colSpan: 6 }, 'No submitted inputs match these filters.'))))),
        h(ManagementPagination, { page: agencyPage, total: visibleInputs.length, label: 'inputs', onChange: setAgencyPage }));

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
    const reportsContent = h('section', { className: 'management-card management-table-card', 'aria-label': 'Reports and summaries' },
        h('div', { className: 'management-card__heading' }, h('div', null,
            h('h2', null, selectedReport ? selectedReport.title : 'Reports & Summary'),
            h('p', null, selectedReport ? selectedReport.description : 'Browse reporting datasets, inspect records and export CSV files.')),
            selectedReport ? h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => { setActiveReport(''); setReportPage(1); } }, 'Back to reports') : null),
        selectedReport
            ? h(React.Fragment, null,
                h('div', { className: 'management-report-detail__actions' }, h('span', null, `${selectedReport.rows.length} ${selectedReport.label}`),
                    h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', disabled: loading || errors.length > 0 || !selectedReport.rows.length, onClick: () => downloadCsv(`${selectedReport.id}-report.csv`, selectedReport.rows) }, 'Export CSV')),
                h('div', { className: 'management-table-scroll' }, h('table', null,
                    h('thead', null, h('tr', null, (selectedReport.rows.length ? Object.keys(selectedReport.rows[0]) : ['No records']).map(key => h('th', { key, scope: 'col' }, key.replaceAll('_', ' '))))),
                    h('tbody', null, selectedReport.rows.length ? pageRows(selectedReport.rows, reportPage).map((row, index) => h('tr', { key: `${reportPage}-${index}` }, Object.keys(row).map(key => h('td', { key }, String(row[key] ?? '—'))))) : h('tr', null, h('td', null, 'No records available.'))))),
                h(ManagementPagination, { page: reportPage, total: selectedReport.rows.length, label: 'records', onChange: setReportPage }))
            : h('div', { className: 'management-report-list' }, visibleReports.map(report => h('article', { className: 'management-report-list__row', key: report.id },
                h('span', { className: 'management-report-card__icon' }, h('i', { className: `bi ${report.icon}`, 'aria-hidden': true })),
                h('div', { className: 'management-report-list__copy' }, h('h3', null, report.title), h('p', null, report.description), h('small', null, `${loading ? '—' : report.count} ${report.label}`)),
                h('div', { className: 'management-report-card__actions' },
                    h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: loading, onClick: () => { setActiveReport(report.id); setReportPage(1); } }, 'View'),
                    h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', disabled: loading || errors.length > 0 || !report.rows.length, onClick: () => downloadCsv(`${report.id}-report.csv`, report.rows) }, 'Export CSV'))))));

    const pageContent = activeTab === 'inputs' ? inputsContent : activeTab === 'alignment' ? alignmentMappingContent : activeTab === 'reports' ? reportsContent : dashboardContent;
    const pageTitle = activeTab === 'inputs' ? 'Input Review' : activeTab === 'alignment' ? 'Alignment Review' : activeTab === 'reports' ? 'Reports & Summary' : 'Monitoring';
    const pageDescription = activeTab === 'inputs' ? 'Read submitted planning inputs and their review outcomes.' : activeTab === 'alignment' ? 'Review strategic associations and missing links.' : activeTab === 'reports' ? 'Inspect and export strategic planning summaries.' : 'Monitor responsible Offices / Agencies and objective execution in approved plans.';
    const scopeOptions = [
        ['planId', 'Strategic Plan', activePlans.map(plan => [String(plan.record_id), plan.title || `Plan ${plan.record_id}`])],
        ['year', 'Planning period', planningYears(plans).map(year => [String(year), String(year)])],
        ['office', 'Office / Unit', agencies.map(name => [name, name])],
        ['planStatus', 'Plan status', [...new Set(plans.map(plan => plan.status).filter(Boolean))].sort().map(status => [status, status === 'finished' ? 'Finalized' : status.replaceAll('_', ' ')])],
        ['objectiveStatus', 'Objective status', [['not_started', 'Not Started'], ['in_progress', 'In Progress'], ['completed', 'Completed'], ...(activeTab === 'dashboard' ? [['overdue', 'Overdue']] : [])]],
        ['approvalStatus', 'Approval status', [['not_submitted', 'Not submitted'], ['under_approval', 'Awaiting approval'], ['approved', 'Approved'], ['rejected', 'Returned / rejected']]],
    ];
    const updateScope = (key, value) => {
        setScopeFilters(previous => ({ ...previous, [key]: value }));
        setPlanPage(1); setMonitorObjectivePage(1); setAlignmentPage(1); setAgencyPage(1); setReportPage(1); setSelectedPlanId('');
    };

    return h('div', { className: `app-shell management-dashboard${activeTab === 'dashboard' ? ' management-dashboard--monitoring' : ''}` },
        h(AppSidebar),
        h('main', { className: 'app-shell-main' }, h('div', { className: 'management-dashboard__content' },
            h('header', { className: 'management-dashboard__header' },
                h('div', null, h('p', { className: 'management-dashboard__eyebrow' }, 'Management / Executive'), h('h1', null, pageTitle), h('p', null, pageDescription)),
                h('div', { className: 'management-dashboard__controls' },
                    h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setRefreshCount(value => value + 1), disabled: loading, 'aria-label': 'Refresh dashboard data' }, h('i', { className: 'bi bi-arrow-clockwise' })))),
            errors.length ? h('div', { className: 'management-dashboard__errors', role: 'alert' }, errors.map(error => h('p', { key: error }, error))) : null,
            h('section', { className: 'management-scope-filters', 'aria-label': 'Authorized information filters' },
                activeTab === 'dashboard' && h('label', null, h('span', null, 'Find a plan'), h('input', { type: 'search', value: planSearch, placeholder: 'Plan title, ID or agency', onChange: event => { setPlanSearch(event.target.value); setPlanPage(1); setSelectedPlanId(''); } })),
                scopeOptions.filter(([key]) => activeTab === 'inputs' ? !['objectiveStatus', 'approvalStatus'].includes(key) : activeTab === 'alignment' ? !['objectiveStatus', 'approvalStatus'].includes(key) : activeTab === 'dashboard' ? !['planStatus', 'approvalStatus'].includes(key) : true).map(([key, label, options]) => h('label', { key }, h('span', null, label),
                    h('select', { value: scopeFilters[key], onChange: event => updateScope(key, event.target.value) },
                        h('option', { value: '' }, `All ${label.toLowerCase()}`), options.map(([value, text]) => h('option', { key: value, value }, text))))),
                (Object.values(scopeFilters).some(Boolean) || (activeTab === 'dashboard' && planSearch)) ? h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => { setPlanSearch(''); setScopeFilters({ planId: '', year: '', office: '', planStatus: '', objectiveStatus: '', approvalStatus: '' }); setPlanPage(1); setMonitorObjectivePage(1); setAlignmentPage(1); setAgencyPage(1); setReportPage(1); setSelectedPlanId(''); } }, 'Clear filters') : null),
            h('section', { className: 'management-dashboard__panel management-dashboard__panel--standalone', 'aria-label': pageTitle },
                activeTab === 'reports' ? h(React.Fragment, null,
                    h('section', { className: 'management-kpis', 'aria-label': 'Strategic planning summary' }, kpiCards),
                    h('section', { className: 'management-oversight', 'aria-label': 'Management status overview' },
                        h('article', null, h('h2', null, 'Plan approvals'), h('p', null, `${pendingPlans.length} awaiting · ${approvedPlans.length} approved · ${returnedPlans.length} returned / rejected`)),
                        h('article', null, h('h2', null, 'Office performance'), h('p', null, `${performanceRows.length} office(s) · ${filteredObjectives.length} assigned objective(s)`)),
                        canViewInputs ? h('article', null, h('h2', null, 'Input consolidation'), h('p', null, `${inputCounts.pending} pending · ${inputCounts.approved} approved · ${inputCounts.rejected} rejected`)) : null,
                        h('article', null, h('h2', null, 'Overdue objectives'), h('p', null, `${riskRows.length} overdue`)))) : null,
                pageContent),
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
