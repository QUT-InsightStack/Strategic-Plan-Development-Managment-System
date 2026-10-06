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
    const canViewInputs = can(P.INPUTS_VIEW, session) && can('implementation_inputs.view_all', session);
    const queryTab = new URLSearchParams(window.location.search).get('tab');
    const activeTab = queryTab === 'alignment' && can('relations.view', session) ? 'alignment' : queryTab === 'reports' ? 'reports' : 'dashboard';
    const alignmentSection = new URLSearchParams(window.location.search).get('section') === 'agency' ? 'agency' : 'mapping';
    const [scopeFilters, setScopeFilters] = React.useState({ planId: '', year: '', office: '', planStatus: '', objectiveStatus: '', approvalStatus: '' });
    const [planSearch, setPlanSearch] = React.useState('');
    const [planLevel, setPlanLevel] = React.useState('');
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
                loadAllManagementPages(listAllStrategicObjectives),
                can(P.PLANS_VIEW, session) ? listAssignedPlanSubmissions() : Promise.resolve([]),
                canViewInputs ? loadAllManagementPages(listSubmittedInputs) : Promise.resolve([]),
            ]);
            if (!active) return;
            const nextErrors = [];
            if (results[0].status === 'fulfilled') setPlans(results[0].value);
            else nextErrors.push(`Strategic plans: ${results[0].reason.message}`);
            if (results[1].status === 'fulfilled') setObjectives(results[1].value);
            else nextErrors.push(`Objectives: ${results[1].reason.message}`);
            if (results[2].status === 'fulfilled') setReviews(results[2].value);
            else nextErrors.push(`Assigned reviews: ${results[2].reason.message}`);
            if (results[3].status === 'fulfilled') setInputs(results[3].value);
            else nextErrors.push(`Agency inputs: ${results[3].reason.message}`);
            setErrors(nextErrors);
            setLoading(false);
        }
        load();
        return () => { active = false; };
    }, [refreshCount, session, canViewInputs]);

    const scoped = filterManagementRows(plans, objectives, scopeFilters, inputs);
    const filteredPlans = scoped.plans;
    const filteredObjectives = scoped.objectives;
    const agencies = [...new Set([...objectives.map(officeName), ...inputs.map(input => input.responsible_office_agency), ...plans.map(plan => plan.department_agency)].filter(Boolean))].sort();
    const agencyObjectives = filteredObjectives;
    const allowedPlanIds = new Set(filteredPlans.map(plan => String(plan.record_id)));
    const allowedObjectiveIds = new Set(filteredObjectives.map(objective => String(objective.objective_id)));
    const filteredInputs = inputs.filter(input => allowedPlanIds.has(String(input.strategic_plan_id))
        && (!scopeFilters.office || input.responsible_office_agency === scopeFilters.office)
        && (!scopeFilters.objectiveStatus || allowedObjectiveIds.has(String(input.objective_id))));
    const filteredReviews = reviews.filter(review => allowedPlanIds.has(String(review.planId)));
    const completed = filteredObjectives.filter(item => progressStatus(item) === 'completed').length;
    const ongoing = filteredObjectives.filter(item => progressStatus(item) === 'in_progress').length;
    const alignedCount = filteredObjectives.filter(item => (item.presidential_agenda_items || []).length && (item.pdp_chapters || []).length).length;
    const alignmentCoverage = filteredObjectives.length ? Math.round(alignedCount * 100 / filteredObjectives.length) : 0;
    const plansById = new Map(filteredPlans.map(plan => [String(plan.record_id), plan]));
    const delayed = filteredObjectives.filter(objective => objectiveRisk(objective, plansById.get(String(objective.strategic_plan_id))) === 'Overdue').length;
    const pendingPlans = filteredPlans.filter(plan => plan.approval_status === 'under_approval');
    const approvedPlans = filteredPlans.filter(plan => plan.approval_status === 'approved');
    const returnedPlans = filteredPlans.filter(plan => plan.approval_status === 'rejected');
    const riskRows = filteredObjectives.map(objective => ({ objective, plan: plansById.get(String(objective.strategic_plan_id)) }))
        .map(row => ({ ...row, risk: objectiveRisk(row.objective, row.plan) })).filter(row => row.risk);
    const performanceRows = officePerformance(filteredObjectives);
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

    const childrenByParent = new Map();
    filteredPlans.forEach(plan => (plan.parents || []).forEach(parent => {
        const key = String(parent.record_id);
        childrenByParent.set(key, [...(childrenByParent.get(key) || []), String(plan.record_id)]);
    }));
    function planTreeIds(planId) {
        const visited = new Set();
        const queue = [String(planId)];
        while (queue.length) {
            const id = queue.shift();
            if (visited.has(id)) continue;
            visited.add(id);
            queue.push(...(childrenByParent.get(id) || []));
        }
        return visited;
    }
    const progressByPlan = filteredPlans.map(plan => {
        const tree = planTreeIds(plan.record_id);
        const planObjectives = filteredObjectives.filter(item => tree.has(String(item.strategic_plan_id)));
        const counts = { completed: 0, in_progress: 0, not_started: 0 };
        planObjectives.forEach(item => { counts[progressStatus(item)] = (counts[progressStatus(item)] || 0) + 1; });
        const average = planObjectives.length ? Math.round(planObjectives.reduce((sum, item) => sum + progressPercent(item), 0) / planObjectives.length) : 0;
        return { plan, objectives: planObjectives, counts, average };
    });
    const availableLevels = [...new Set(filteredPlans.map(plan => plan.level).filter(Boolean))].sort();
    const monitoringPlans = progressByPlan.filter(item =>
        (!planLevel || item.plan.level === planLevel)
        && (!planSearch.trim() || `${item.plan.record_id} ${item.plan.title || ''} ${item.plan.department_agency || ''}`.toLowerCase().includes(planSearch.trim().toLowerCase())));
    const selectedProgress = progressByPlan.find(item => String(item.plan.record_id) === selectedPlanId);

    const reportRows = {
        plans: filteredPlans.map(plan => ({ plan_id: plan.record_id, plan: plan.title, status: plan.status, approval_status: plan.approval_status || 'not_submitted', office: plan.department_agency || '', planning_start_date: plan.planning_start_date, planning_end_date: plan.planning_end_date })),
        progress: filteredObjectives.map(item => ({ plan: item.strategic_plan?.title || '', objective: item.objective_title, responsible_office: officeName(item), progress_percent: progressPercent(item), status: statusLabels[progressStatus(item)], updated_at: item.progress_updated_at || '' })),
        alignment: filteredObjectives.map(item => ({ plan: item.strategic_plan?.title || '', presidential_agenda: labelFor(item.presidential_agenda_items, ['title', 'item_title', 'agenda_title', 'name']), pdp_chapter: labelFor(item.pdp_chapters, ['chapter_title', 'title', 'name']), objective: item.objective_title, agency: officeName(item) })),
        reviews: filteredReviews.map(item => ({ plan_id: item.planId, plan: item.plan_snapshot?.title || `Strategic Plan ${item.planId}`, stage: item.currentStage?.name || '', submitted_at: item.submittedAt || '', workflow: item.workflowName || '' })),
        inputs: filteredInputs.map(item => ({ plan: item.strategic_plan?.title || '', objective: item.objective?.objective_title || '', office: item.responsible_office_agency || '', input_type: item.input_type, status: item.review_status, submitted_at: item.submitted_at || '', content: item.content || '' })),
        offices: performanceRows,
        risks: riskRows.map(({ objective, plan, risk }) => ({ plan: plan?.title || '', objective: objective.objective_title || '', office: officeName(objective), progress_percent: progressPercent(objective), planning_end_date: plan?.planning_end_date || '', risk })),
        approvals: filteredPlans.filter(plan => ['under_approval', 'approved', 'rejected'].includes(plan.approval_status)).map(plan => ({ plan_id: plan.record_id, plan: plan.title, approval_status: plan.approval_status, decision_display: plan.approval_status === 'rejected' ? 'Returned for correction (backend: rejected)' : plan.approval_status, office: plan.department_agency || '' })),
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

    const dashboardContent = h(React.Fragment, null,
        h('div', { className: 'management-monitor-filters', 'aria-label': 'Plan monitoring filters' },
            h('label', null, h('span', null, 'Find a plan'), h('input', { type: 'search', value: planSearch, placeholder: 'Plan title, ID or agency', onChange: event => { setPlanSearch(event.target.value); setPlanPage(1); setSelectedPlanId(''); } })),
            h('label', null, h('span', null, 'Plan level'), h('select', { value: planLevel, onChange: event => { setPlanLevel(event.target.value); setPlanPage(1); setSelectedPlanId(''); } },
                h('option', { value: '' }, 'All levels'), availableLevels.map(level => h('option', { key: level, value: level }, level.replaceAll('_', ' '))))),
            (planSearch || planLevel) ? h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', onClick: () => { setPlanSearch(''); setPlanLevel(''); setPlanPage(1); } }, 'Clear filters') : null),
        h('section', { className: 'management-card management-chart-card' },
            h('div', { className: 'management-card__heading' }, h('div', null, h('h2', null, 'Strategic Objective Progress'), h('p', null, 'Objective status distribution across plans you can access.'))),
            loading ? h('p', { className: 'management-empty' }, 'Loading progress data…') : monitoringPlans.length ? h('div', { className: 'management-bars' }, pageRows(monitoringPlans, planPage, 8).map(item => {
                const total = item.objectives.length || 1;
                return h('div', { className: 'management-bar-row', key: item.plan.record_id },
                    h('span', { className: 'management-bar-row__label', title: item.plan.title }, item.plan.title),
                    h('div', { className: 'management-bar' },
                        h('span', { className: 'is-completed', style: { width: `${item.counts.completed * 100 / total}%` } }),
                        h('span', { className: 'is-ongoing', style: { width: `${item.counts.in_progress * 100 / total}%` } }),
                        h('span', { className: 'is-not-started', style: { width: `${item.counts.not_started * 100 / total}%` } })),
                    h('strong', null, `${item.average}%`));
            })) : h('p', { className: 'management-empty' }, planSearch || planLevel || Object.values(scopeFilters).some(Boolean) ? 'No plans match these filters.' : 'No objective progress is available.'),
            h('div', { className: 'management-legend' },
                [['is-completed', 'Completed'], ['is-ongoing', 'In Progress'], ['is-not-started', 'Not Started']].map(([tone, label]) => h('span', { key: tone }, h('i', { className: tone }), label)))),
        h('section', { className: 'management-card management-table-card' },
            h('div', { className: 'management-card__heading' }, h('div', null, h('h2', null, 'Progress Breakdown'), h('p', null, `${monitoringPlans.length} of ${filteredPlans.length} plan(s) · ${filteredObjectives.length} objective(s). Parent plans include objectives from their child plans.`))),
            h('div', { className: 'management-table-scroll' }, h('table', null,
                h('thead', null, h('tr', null, ['Strategic Plan', 'Level / Parent', 'Objectives', 'Completed', 'In Progress', 'Not Started', 'Overdue / At risk', 'Average Progress', 'Action'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 9 }, 'Loading plan progress…')) : monitoringPlans.length ? pageRows(monitoringPlans, planPage, 8).map(item => h('tr', { key: item.plan.record_id },
                    h('th', { scope: 'row' }, item.plan.title),
                    h('td', null, [item.plan.level?.replaceAll('_', ' '), (item.plan.parents || []).map(parent => parent.title).join(', ')].filter(Boolean).join(' · ') || '—'),
                    h('td', null, item.objectives.length), h('td', null, item.counts.completed), h('td', null, item.counts.in_progress), h('td', null, item.counts.not_started),
                    h('td', null, item.objectives.filter(objective => objectiveRisk(objective, plansById.get(String(objective.strategic_plan_id)))).length),
                    h('td', null, h('div', { className: 'management-progress-cell' }, h('span', null, `${item.average}%`), h('span', { className: 'management-progress-track' }, h('i', { style: { width: `${item.average}%` } })))),
                    h('td', null, h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => { setSelectedPlanId(String(item.plan.record_id)); setMonitorObjectivePage(1); } }, 'View objectives')))) : h('tr', null, h('td', { colSpan: 9 }, plans.length ? 'No strategic plans match these filters.' : 'No strategic plans found.'))))),
            h(ManagementPagination, { page: planPage, total: monitoringPlans.length, pageSize: 8, label: 'plans', onChange: next => { setPlanPage(next); setSelectedPlanId(''); } }),
            selectedProgress ? h('div', { className: 'management-monitor-detail' },
                h('div', { className: 'management-card__heading' }, h('div', null, h('h3', null, selectedProgress.plan.title), h('p', null, `${selectedProgress.objectives.length} objective(s) · ${selectedProgress.average}% average progress`)),
                    h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setSelectedPlanId('') }, 'Close')),
                h('div', { className: 'management-table-scroll' }, h('table', null,
                    h('thead', null, h('tr', null, ['Objective', 'Plan', 'Responsible office', 'Progress', 'Status', 'Risk', 'Last update'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                    h('tbody', null, selectedProgress.objectives.length ? pageRows(selectedProgress.objectives, monitorObjectivePage).map(objective => h('tr', { key: objective.objective_id },
                        h('th', { scope: 'row' }, objective.objective_title || `Objective ${objective.objective_id}`),
                        h('td', null, plansById.get(String(objective.strategic_plan_id))?.title || '—'),
                        h('td', null, officeName(objective)),
                        h('td', null, `${progressPercent(objective)}%`), h('td', null, statusLabels[progressStatus(objective)] || progressStatus(objective)),
                        h('td', null, objectiveRisk(objective, plansById.get(String(objective.strategic_plan_id))) || '—'),
                        h('td', null, managementDateLabel(objective.progress_updated_at)))) : h('tr', null, h('td', { colSpan: 7 }, 'No objectives under this plan.'))))),
                h(ManagementPagination, { page: monitorObjectivePage, total: selectedProgress.objectives.length, label: 'objectives', onChange: setMonitorObjectivePage })) : null));

    const alignmentMappingContent = h('section', { className: 'management-card management-table-card' },
        h('div', { className: 'management-card__heading' }, h('div', null, h('h2', null, 'Strategic Alignment Review'), h('p', null, `${alignedCount} of ${filteredObjectives.length} objectives linked to both Agenda and PDP (${alignmentCoverage}% coverage).`))),
        h('div', { className: 'management-table-scroll' }, h('table', null,
            h('thead', null, h('tr', null, ['Presidential Agenda', 'PDP Chapter', 'Strategic Objective', 'Agency / Office', 'Alignment', 'Progress', 'Status'].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 7 }, 'Loading alignment data…')) : filteredObjectives.length ? pageRows(filteredObjectives, alignmentPage).map(item => {
                const status = progressStatus(item);
                const agenda = labelFor(item.presidential_agenda_items, ['title', 'item_title', 'agenda_title', 'name']);
                const chapter = labelFor(item.pdp_chapters, ['chapter_title', 'title', 'name']);
                const office = officeName(item);
                const alignmentState = agenda !== '—' && chapter !== '—' ? 'Complete' : agenda !== '—' || chapter !== '—' ? 'Partial' : 'Unmapped';
                return h('tr', { key: item.objective_id }, h('td', null, agenda), h('td', null, chapter), h('td', null, item.objective_title), h('td', null, office), h('td', null, alignmentState),
                    h('td', null, h('div', { className: 'management-progress-cell' }, h('span', null, `${progressPercent(item)}%`), h('span', { className: 'management-progress-track' }, h('i', { style: { width: `${progressPercent(item)}%` } })))),
                    h('td', null, h('span', { className: `management-status is-${status}` }, statusLabels[status] || status)));
            }) : h('tr', null, h('td', { colSpan: 7 }, 'No strategic objectives match these filters.'))))),
        h(ManagementPagination, { page: alignmentPage, total: filteredObjectives.length, label: 'objectives', onChange: setAlignmentPage }));

    const agencyMappingContent = h('section', { className: 'management-card management-table-card' },
        h('div', { className: 'management-card__heading' }, h('div', null,
            h('h2', null, 'Agency Input Review'),
            h('p', null, 'Review the mapping summary for objectives assigned to each agency or office. Use the Office / Unit filter above to focus this list.'))),
        h('div', { className: 'management-table-scroll' }, h('table', null,
            h('thead', null, h('tr', null, ['Agency / Office', 'Strategic Plan', 'Strategic Objective', 'Presidential Agenda', 'PDP Chapter', 'Progress'].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 6 }, 'Loading agency mapping…')) : agencyObjectives.length ? pageRows(agencyObjectives, agencyPage).map(item =>
                h('tr', { key: item.objective_id },
                    h('th', { scope: 'row' }, officeName(item)),
                    h('td', null, item.strategic_plan?.title || plansById.get(String(item.strategic_plan_id))?.title || '—'),
                    h('td', null, item.objective_title || `Objective ${item.objective_id}`),
                    h('td', null, labelFor(item.presidential_agenda_items, ['title', 'item_title', 'agenda_title', 'name'])),
                    h('td', null, labelFor(item.pdp_chapters, ['chapter_title', 'title', 'name'])),
                    h('td', null, `${progressPercent(item)}%`))) : h('tr', null, h('td', { colSpan: 6 }, 'No objectives match these filters.'))))),
        h(ManagementPagination, { page: agencyPage, total: agencyObjectives.length, label: 'objectives', onChange: setAgencyPage }));

    const alignmentContent = alignmentSection === 'agency' ? agencyMappingContent : alignmentMappingContent;

    const reports = [
        { id: 'plans', title: 'Strategic Plan Register', description: 'Plan title, lifecycle status and planning period.', icon: 'bi-journal-text', count: plans.length, label: 'plans', rows: reportRows.plans },
        { id: 'progress', title: 'Objective Progress Summary', description: 'Progress percentage, calculated status, responsible office and last update.', icon: 'bi-graph-up', count: filteredObjectives.length, label: 'objectives', rows: reportRows.progress },
        { id: 'alignment', title: 'Strategic Alignment Report', description: 'Agenda, PDP chapter, objective and responsible agency mappings.', icon: 'bi-diagram-3', count: filteredObjectives.length, label: 'objective mappings', rows: reportRows.alignment },
        { id: 'inputs', title: 'Agency Input Report', description: 'Submitted agency implementation updates, review status and submission date.', icon: 'bi-building-check', count: filteredInputs.length, label: 'agency inputs', rows: reportRows.inputs },
        { id: 'reviews', title: 'Assigned Approval Queue', description: 'Plan approvals assigned to your account and their current workflow stage.', icon: 'bi-clipboard-check', count: filteredReviews.length, label: 'pending reviews', rows: reportRows.reviews },
        { id: 'approvals', title: 'Plan Approval Status', description: 'Awaiting, approved and returned plans. Returned decisions use the backend rejected status.', icon: 'bi-clipboard-check', count: reportRows.approvals.length, label: 'plans', rows: reportRows.approvals },
        { id: 'offices', title: 'Office / Unit Performance', description: 'Objective counts, completed objectives and average progress by responsible office.', icon: 'bi-people', count: performanceRows.length, label: 'offices', rows: reportRows.offices },
        { id: 'risks', title: 'Overdue & At-risk Items', description: 'Incomplete objectives past their plan end date or below 75% within 30 days of it.', icon: 'bi-exclamation-triangle', count: riskRows.length, label: 'items', rows: reportRows.risks },
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
                    h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', disabled: !selectedReport.rows.length, onClick: () => downloadCsv(`${selectedReport.id}-report.csv`, selectedReport.rows) }, 'Export CSV')),
                h('div', { className: 'management-table-scroll' }, h('table', null,
                    h('thead', null, h('tr', null, (selectedReport.rows.length ? Object.keys(selectedReport.rows[0]) : ['No records']).map(key => h('th', { key, scope: 'col' }, key.replaceAll('_', ' '))))),
                    h('tbody', null, selectedReport.rows.length ? pageRows(selectedReport.rows, reportPage).map((row, index) => h('tr', { key: `${reportPage}-${index}` }, Object.keys(row).map(key => h('td', { key }, String(row[key] ?? '—'))))) : h('tr', null, h('td', null, 'No records available.'))))),
                h(ManagementPagination, { page: reportPage, total: selectedReport.rows.length, label: 'records', onChange: setReportPage }))
            : h('div', { className: 'management-report-list' }, visibleReports.map(report => h('article', { className: 'management-report-list__row', key: report.id },
                h('span', { className: 'management-report-card__icon' }, h('i', { className: `bi ${report.icon}`, 'aria-hidden': true })),
                h('div', { className: 'management-report-list__copy' }, h('h3', null, report.title), h('p', null, report.description), h('small', null, `${loading ? '—' : report.count} ${report.label}`)),
                h('div', { className: 'management-report-card__actions' },
                    h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: loading, onClick: () => { setActiveReport(report.id); setReportPage(1); } }, 'View'),
                    h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', disabled: loading || !report.rows.length, onClick: () => downloadCsv(`${report.id}-report.csv`, report.rows) }, 'Export CSV'))))));

    const pageContent = activeTab === 'alignment' ? alignmentContent : activeTab === 'reports' ? reportsContent : dashboardContent;
    const pageTitle = activeTab === 'alignment' ? alignmentSection === 'agency' ? 'Agency Input Review' : 'Strategic Alignment Review' : activeTab === 'reports' ? 'Reports & Summary' : 'Monitoring';
    const pageDescription = activeTab === 'alignment' ? 'Review Agenda, PDP and objective associations by plan or agency.' : activeTab === 'reports' ? 'Inspect and export strategic planning summaries.' : 'Monitor plan hierarchy and objective progress.';
    const scopeOptions = [
        ['planId', 'Strategic Plan', plans.map(plan => [String(plan.record_id), plan.title || `Plan ${plan.record_id}`])],
        ['year', 'Planning period', planningYears(plans).map(year => [String(year), String(year)])],
        ['office', 'Office / Unit', agencies.map(name => [name, name])],
        ['planStatus', 'Plan status', [...new Set(plans.map(plan => plan.status).filter(Boolean))].sort().map(status => [status, status.replaceAll('_', ' ')])],
        ['objectiveStatus', 'Objective status', [['not_started', 'Not Started'], ['in_progress', 'Ongoing'], ['completed', 'Completed']]],
        ['approvalStatus', 'Approval status', [['not_submitted', 'Not submitted'], ['under_approval', 'Awaiting approval'], ['approved', 'Approved'], ['rejected', 'Returned / rejected']]],
    ];
    const updateScope = (key, value) => {
        setScopeFilters(previous => ({ ...previous, [key]: value }));
        setPlanPage(1); setAlignmentPage(1); setAgencyPage(1); setReportPage(1); setSelectedPlanId('');
    };

    return h('div', { className: 'app-shell management-dashboard' },
        h(AppSidebar),
        h('main', { className: 'app-shell-main' }, h('div', { className: 'management-dashboard__content' },
            h('header', { className: 'management-dashboard__header' },
                h('div', null, h('p', { className: 'management-dashboard__eyebrow' }, 'Management / Executive'), h('h1', null, pageTitle), h('p', null, pageDescription)),
                h('div', { className: 'management-dashboard__controls' },
                    activeTab === 'reports' ? h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', onClick: () => downloadCsv('management-dashboard-progress.csv', reportRows.progress), disabled: loading || !reportRows.progress.length }, h('i', { className: 'bi bi-cloud-arrow-down-fill' }), 'Export Dashboard') : null,
                    h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setRefreshCount(value => value + 1), disabled: loading, 'aria-label': 'Refresh dashboard data' }, h('i', { className: 'bi bi-arrow-clockwise' })))),
            errors.length ? h('div', { className: 'management-dashboard__errors', role: 'alert' }, errors.map(error => h('p', { key: error }, error))) : null,
            h('section', { className: 'management-scope-filters', 'aria-label': 'Authorized information filters' },
                scopeOptions.map(([key, label, options]) => h('label', { key }, h('span', null, label),
                    h('select', { value: scopeFilters[key], onChange: event => updateScope(key, event.target.value) },
                        h('option', { value: '' }, `All ${label.toLowerCase()}`), options.map(([value, text]) => h('option', { key: value, value }, text))))),
                Object.values(scopeFilters).some(Boolean) ? h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => { setScopeFilters({ planId: '', year: '', office: '', planStatus: '', objectiveStatus: '', approvalStatus: '' }); setPlanPage(1); setAlignmentPage(1); setAgencyPage(1); setReportPage(1); } }, 'Clear filters') : null),
            h('section', { className: 'management-dashboard__panel management-dashboard__panel--standalone', 'aria-label': pageTitle },
                activeTab === 'reports' ? h(React.Fragment, null,
                    h('section', { className: 'management-kpis', 'aria-label': 'Strategic planning summary' }, kpiCards),
                    h('section', { className: 'management-oversight', 'aria-label': 'Management status overview' },
                        h('article', null, h('h2', null, 'Plan approvals'), h('p', null, `${pendingPlans.length} awaiting · ${approvedPlans.length} approved · ${returnedPlans.length} returned / rejected`)),
                        h('article', null, h('h2', null, 'Office performance'), h('p', null, `${performanceRows.length} office(s) · ${filteredObjectives.length} assigned objective(s)`)),
                        canViewInputs ? h('article', null, h('h2', null, 'Input consolidation'), h('p', null, `${inputCounts.pending} pending · ${inputCounts.approved} approved · ${inputCounts.rejected} rejected`)) : null,
                        h('article', null, h('h2', null, 'Planning risks'), h('p', null, `${riskRows.filter(row => row.risk === 'Overdue').length} overdue · ${riskRows.filter(row => row.risk === 'At risk').length} at risk`)))) : null,
                pageContent),
            h('footer', { className: 'management-dashboard__footer' }, '© 2026 Strategic Planning Management System. All rights reserved.'))));
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading Management access…'));
apiRequest('/api/auth/me').then(payload => {
    const session = saveAccessSession(createAccessSession(payload.data));
    if (!enforcePageAccess()) return;
    if (!isManagementSession(session)) { window.location.replace('/access-denied'); return; }
    root.render(h(ManagementErrorBoundary, null, h(ManagementDashboard, { session })));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
