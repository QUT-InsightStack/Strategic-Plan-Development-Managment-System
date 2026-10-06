import { AppSidebar } from '../../components/AppSidebar.js';
import { apiRequest } from '../../api/api-client.js';
import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { listAllStrategicObjectives } from '../../api/strategic-objectives-api.js';
import { listAssignedPlanSubmissions } from '../../api/plan-approval-api.js';
import { listSubmittedInputs } from '../../api/implementation-inputs-api.js';
import { createAccessSession, saveAccessSession, can } from '../../access/access-session.js';
import { PERMISSIONS as P } from '../../access/access-policy.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { isManagementSession } from '../../access/management-access.js';
import { ManagementPagination, pageRows } from '../../components/ManagementPagination.js';

const h = React.createElement;
const statusLabels = { completed: 'Completed', in_progress: 'Ongoing', not_started: 'Not Started' };

function rowsFrom(payload) {
    return Array.isArray(payload?.data) ? payload.data : [];
}

async function loadAllPages(loader) {
    const rows = [];
    let page = 1;
    let lastPage = 1;
    do {
        const payload = await loader({ page, per_page: 100 });
        rows.push(...rowsFrom(payload));
        lastPage = Number(payload?.meta?.last_page || payload?.last_page || 1);
        page += 1;
    } while (page <= lastPage);
    return rows;
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function objectiveStatus(objective) {
    return objective.progress_status || (Number(objective.progress_percentage) >= 100 ? 'completed' : Number(objective.progress_percentage) > 0 ? 'in_progress' : 'not_started');
}

function percent(objective) {
    return Math.max(0, Math.min(100, Number(objective.progress_percentage) || 0));
}

function progressDate(objective) {
    const value = objective.progress_updated_at;
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function withinPeriod(objective, period, now = new Date()) {
    if (period === 'all') return true;
    const updated = progressDate(objective);
    if (!updated) return false;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - Number(period) + 1);
    return updated >= start && updated <= now;
}

function isDelayed(objective, plansById) {
    if (objectiveStatus(objective) === 'completed') return false;
    const plan = plansById.get(String(objective.strategic_plan_id));
    if (!plan?.planning_end_date) return false;
    const end = new Date(`${plan.planning_end_date}T23:59:59`);
    return !Number.isNaN(end.getTime()) && end < new Date();
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
    const queryTab = new URLSearchParams(window.location.search).get('tab');
    const activeTab = queryTab === 'alignment' && can('relations.view', session) ? 'alignment' : queryTab === 'reports' ? 'reports' : 'dashboard';
    const alignmentSection = new URLSearchParams(window.location.search).get('section') === 'agency' ? 'agency' : 'mapping';
    const [reportingPeriod, setReportingPeriod] = React.useState('all');
    const [planSearch, setPlanSearch] = React.useState('');
    const [planLevel, setPlanLevel] = React.useState('');
    const [selectedPlanId, setSelectedPlanId] = React.useState('');
    const [activeReport, setActiveReport] = React.useState('');
    const [planPage, setPlanPage] = React.useState(1);
    const [monitorObjectivePage, setMonitorObjectivePage] = React.useState(1);
    const [alignmentPage, setAlignmentPage] = React.useState(1);
    const [agencyPage, setAgencyPage] = React.useState(1);
    const [agencyFilter, setAgencyFilter] = React.useState('');
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
                loadAllPages(params => listStrategicPlans(params)),
                loadAllPages(params => listAllStrategicObjectives(params)),
                can(P.PLANS_VIEW, session) ? listAssignedPlanSubmissions() : Promise.resolve([]),
                can(P.INPUTS_VIEW, session) ? loadAllPages(params => listSubmittedInputs(params)) : Promise.resolve([]),
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
    }, [refreshCount, session]);

    const filteredObjectives = objectives.filter(objective => withinPeriod(objective, reportingPeriod));
    const agencyName = objective => objective.responsible_unit_assignment?.responsible_unit?.name || objective.responsible_office_agency || 'Unassigned';
    const agencies = [...new Set(objectives.map(agencyName))].sort();
    const agencyObjectives = agencyFilter ? objectives.filter(objective => agencyName(objective) === agencyFilter) : objectives;
    const filteredPlans = plans;
    const filteredInputs = inputs;
    const completed = filteredObjectives.filter(item => objectiveStatus(item) === 'completed').length;
    const ongoing = filteredObjectives.filter(item => objectiveStatus(item) === 'in_progress').length;
    const alignedCount = filteredObjectives.filter(item => (item.presidential_agenda_items || []).length && (item.pdp_chapters || []).length).length;
    const alignmentCoverage = filteredObjectives.length ? Math.round(alignedCount * 100 / filteredObjectives.length) : 0;
    const plansById = new Map(filteredPlans.map(plan => [String(plan.record_id), plan]));
    const delayed = filteredObjectives.filter(objective => isDelayed(objective, plansById)).length;

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
        planObjectives.forEach(item => { counts[objectiveStatus(item)] = (counts[objectiveStatus(item)] || 0) + 1; });
        const average = planObjectives.length ? Math.round(planObjectives.reduce((sum, item) => sum + percent(item), 0) / planObjectives.length) : 0;
        return { plan, objectives: planObjectives, counts, average };
    });
    const availableLevels = [...new Set(filteredPlans.map(plan => plan.level).filter(Boolean))].sort();
    const monitoringPlans = progressByPlan.filter(item =>
        (!planLevel || item.plan.level === planLevel)
        && (!planSearch.trim() || `${item.plan.record_id} ${item.plan.title || ''} ${item.plan.department_agency || ''}`.toLowerCase().includes(planSearch.trim().toLowerCase())));
    const selectedProgress = progressByPlan.find(item => String(item.plan.record_id) === selectedPlanId);

    const reportRows = {
        plans: filteredPlans.map(plan => ({ plan_id: plan.record_id, plan: plan.title, status: plan.status, planning_start_date: plan.planning_start_date, planning_end_date: plan.planning_end_date })),
        progress: filteredObjectives.map(item => ({ plan: item.strategic_plan?.title || '', objective: item.objective_title, responsible_office: item.responsible_unit_assignment?.responsible_unit?.name || item.responsible_office_agency || '', progress_percent: percent(item), status: statusLabels[objectiveStatus(item)], updated_at: item.progress_updated_at || '' })),
        alignment: filteredObjectives.map(item => ({ plan: item.strategic_plan?.title || '', presidential_agenda: labelFor(item.presidential_agenda_items, ['title', 'item_title', 'agenda_title', 'name']), pdp_chapter: labelFor(item.pdp_chapters, ['chapter_title', 'title', 'name']), objective: item.objective_title, agency: item.responsible_unit_assignment?.responsible_unit?.name || item.responsible_office_agency || '' })),
        reviews: reviews.map(item => ({ plan_id: item.planId, plan: item.plan_snapshot?.title || `Strategic Plan ${item.planId}`, stage: item.currentStage?.name || '', submitted_at: item.submittedAt || '', workflow: item.workflowName || '' })),
        inputs: filteredInputs.map(item => ({ plan: item.strategic_plan?.title || '', objective: item.objective?.objective_title || '', office: item.responsible_office_agency || '', input_type: item.input_type, status: item.review_status, submitted_at: item.submitted_at || '', content: item.content || '' })),
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
            })) : h('p', { className: 'management-empty' }, planSearch || planLevel ? 'No plans match these filters.' : 'No objective progress is available.'),
            h('div', { className: 'management-legend' },
                [['is-completed', 'Completed'], ['is-ongoing', 'In Progress'], ['is-not-started', 'Not Started']].map(([tone, label]) => h('span', { key: tone }, h('i', { className: tone }), label)))),
        h('section', { className: 'management-card management-table-card' },
            h('div', { className: 'management-card__heading' }, h('div', null, h('h2', null, 'Progress Breakdown'), h('p', null, `${monitoringPlans.length} of ${filteredPlans.length} plan(s) · ${filteredObjectives.length} objective(s). Parent plans include objectives from their child plans.`))),
            h('div', { className: 'management-table-scroll' }, h('table', null,
                h('thead', null, h('tr', null, ['Strategic Plan', 'Level / Parent', 'Objectives', 'Completed', 'In Progress', 'Not Started', 'Average Progress', 'Action'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 8 }, 'Loading plan progress…')) : monitoringPlans.length ? pageRows(monitoringPlans, planPage, 8).map(item => h('tr', { key: item.plan.record_id },
                    h('th', { scope: 'row' }, item.plan.title),
                    h('td', null, [item.plan.level?.replaceAll('_', ' '), (item.plan.parents || []).map(parent => parent.title).join(', ')].filter(Boolean).join(' · ') || '—'),
                    h('td', null, item.objectives.length), h('td', null, item.counts.completed), h('td', null, item.counts.in_progress), h('td', null, item.counts.not_started),
                    h('td', null, h('div', { className: 'management-progress-cell' }, h('span', null, `${item.average}%`), h('span', { className: 'management-progress-track' }, h('i', { style: { width: `${item.average}%` } })))),
                    h('td', null, h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => { setSelectedPlanId(String(item.plan.record_id)); setMonitorObjectivePage(1); } }, 'View objectives')))) : h('tr', null, h('td', { colSpan: 8 }, 'No strategic plans found.'))))),
            h(ManagementPagination, { page: planPage, total: monitoringPlans.length, pageSize: 8, label: 'plans', onChange: next => { setPlanPage(next); setSelectedPlanId(''); } }),
            selectedProgress ? h('div', { className: 'management-monitor-detail' },
                h('div', { className: 'management-card__heading' }, h('div', null, h('h3', null, selectedProgress.plan.title), h('p', null, `${selectedProgress.objectives.length} objective(s) · ${selectedProgress.average}% average progress`)),
                    h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setSelectedPlanId('') }, 'Close')),
                h('div', { className: 'management-table-scroll' }, h('table', null,
                    h('thead', null, h('tr', null, ['Objective', 'Plan', 'Responsible office', 'Progress', 'Status', 'Last update'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                    h('tbody', null, selectedProgress.objectives.length ? pageRows(selectedProgress.objectives, monitorObjectivePage).map(objective => h('tr', { key: objective.objective_id },
                        h('th', { scope: 'row' }, objective.objective_title || `Objective ${objective.objective_id}`),
                        h('td', null, plansById.get(String(objective.strategic_plan_id))?.title || '—'),
                        h('td', null, objective.responsible_unit_assignment?.responsible_unit?.name || objective.responsible_office_agency || '—'),
                        h('td', null, `${percent(objective)}%`), h('td', null, statusLabels[objectiveStatus(objective)] || objectiveStatus(objective)),
                        h('td', null, formatDate(objective.progress_updated_at)))) : h('tr', null, h('td', { colSpan: 6 }, 'No objectives under this plan.'))))),
                h(ManagementPagination, { page: monitorObjectivePage, total: selectedProgress.objectives.length, label: 'objectives', onChange: setMonitorObjectivePage })) : null));

    const alignmentMappingContent = h('section', { className: 'management-card management-table-card' },
        h('div', { className: 'management-card__heading' }, h('div', null, h('h2', null, 'Strategic Alignment Review'), h('p', null, 'Agenda and PDP associations for each objective, with its responsible office.'))),
        h('div', { className: 'management-table-scroll' }, h('table', null,
            h('thead', null, h('tr', null, ['Presidential Agenda', 'PDP Chapter', 'Strategic Objective', 'Agency / Office', 'Progress', 'Status'].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 6 }, 'Loading alignment data…')) : objectives.length ? pageRows(objectives, alignmentPage).map(item => {
                const status = objectiveStatus(item);
                const agenda = labelFor(item.presidential_agenda_items, ['title', 'item_title', 'agenda_title', 'name']);
                const chapter = labelFor(item.pdp_chapters, ['chapter_title', 'title', 'name']);
                const office = item.responsible_unit_assignment?.responsible_unit?.name || item.responsible_office_agency || 'Unassigned';
                return h('tr', { key: item.objective_id }, h('td', null, agenda), h('td', null, chapter), h('td', null, item.objective_title), h('td', null, office),
                    h('td', null, h('div', { className: 'management-progress-cell' }, h('span', null, `${percent(item)}%`), h('span', { className: 'management-progress-track' }, h('i', { style: { width: `${percent(item)}%` } })))),
                    h('td', null, h('span', { className: `management-status is-${status}` }, statusLabels[status] || status)));
            }) : h('tr', null, h('td', { colSpan: 6 }, 'No strategic objectives are available.'))))),
        h(ManagementPagination, { page: alignmentPage, total: objectives.length, label: 'objectives', onChange: setAlignmentPage }));

    const agencyMappingContent = h('section', { className: 'management-card management-table-card' },
        h('div', { className: 'management-card__heading' }, h('div', null,
            h('h2', null, 'Agency Input Review'),
            h('p', null, 'Review the mapping summary for objectives assigned to each agency or office.')),
            h('label', { className: 'management-agency-filter' }, h('span', null, 'Agency / Office'),
                h('select', { value: agencyFilter, onChange: event => { setAgencyFilter(event.target.value); setAgencyPage(1); } },
                    h('option', { value: '' }, 'All agencies'), agencies.map(name => h('option', { key: name, value: name }, name))))),
        h('div', { className: 'management-table-scroll' }, h('table', null,
            h('thead', null, h('tr', null, ['Agency / Office', 'Strategic Plan', 'Strategic Objective', 'Presidential Agenda', 'PDP Chapter', 'Progress'].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 6 }, 'Loading agency mapping…')) : agencyObjectives.length ? pageRows(agencyObjectives, agencyPage).map(item =>
                h('tr', { key: item.objective_id },
                    h('th', { scope: 'row' }, agencyName(item)),
                    h('td', null, item.strategic_plan?.title || plansById.get(String(item.strategic_plan_id))?.title || '—'),
                    h('td', null, item.objective_title || `Objective ${item.objective_id}`),
                    h('td', null, labelFor(item.presidential_agenda_items, ['title', 'item_title', 'agenda_title', 'name'])),
                    h('td', null, labelFor(item.pdp_chapters, ['chapter_title', 'title', 'name'])),
                    h('td', null, `${percent(item)}%`))) : h('tr', null, h('td', { colSpan: 6 }, 'No mapped objectives match this agency.'))))),
        h(ManagementPagination, { page: agencyPage, total: agencyObjectives.length, label: 'objectives', onChange: setAgencyPage }));

    const alignmentContent = alignmentSection === 'agency' ? agencyMappingContent : alignmentMappingContent;

    const reports = [
        { id: 'plans', title: 'Strategic Plan Register', description: 'Plan title, lifecycle status and planning period.', icon: 'bi-journal-text', count: plans.length, label: 'plans', rows: reportRows.plans },
        { id: 'progress', title: 'Objective Progress Summary', description: 'Progress percentage, calculated status, responsible office and last update.', icon: 'bi-graph-up', count: filteredObjectives.length, label: 'objectives', rows: reportRows.progress },
        { id: 'alignment', title: 'Strategic Alignment Report', description: 'Agenda, PDP chapter, objective and responsible agency mappings.', icon: 'bi-diagram-3', count: filteredObjectives.length, label: 'objective mappings', rows: reportRows.alignment },
        { id: 'inputs', title: 'Agency Input Report', description: 'Submitted agency implementation updates, review status and submission date.', icon: 'bi-building-check', count: filteredInputs.length, label: 'agency inputs', rows: reportRows.inputs },
        { id: 'reviews', title: 'Assigned Approval Queue', description: 'Plan approvals assigned to your account and their current workflow stage.', icon: 'bi-clipboard-check', count: reviews.length, label: 'pending reviews', rows: reportRows.reviews },
    ];
    const visibleReports = reports.filter(report => report.id !== 'inputs' || can(P.INPUTS_VIEW, session));
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
                    h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => { setActiveReport(report.id); setReportPage(1); } }, 'View'),
                    h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', disabled: loading || !report.rows.length, onClick: () => downloadCsv(`${report.id}-report.csv`, report.rows) }, 'Export CSV'))))));

    const pageContent = activeTab === 'alignment' ? alignmentContent : activeTab === 'reports' ? reportsContent : dashboardContent;
    const pageTitle = activeTab === 'alignment' ? alignmentSection === 'agency' ? 'Agency Input Review' : 'Strategic Alignment Review' : activeTab === 'reports' ? 'Reports & Summary' : 'Monitoring';
    const pageDescription = activeTab === 'alignment' ? 'Review Agenda, PDP and objective associations by plan or agency.' : activeTab === 'reports' ? 'Inspect and export strategic planning summaries.' : 'Monitor plan hierarchy and objective progress.';

    return h('div', { className: 'app-shell management-dashboard' },
        h(AppSidebar),
        h('main', { className: 'app-shell-main' }, h('div', { className: 'management-dashboard__content' },
            h('header', { className: 'management-dashboard__header' },
                h('div', null, h('p', { className: 'management-dashboard__eyebrow' }, 'Management / Executive'), h('h1', null, pageTitle), h('p', null, pageDescription)),
                h('div', { className: 'management-dashboard__controls' },
                    activeTab !== 'alignment' ? h('label', null, h('span', null, 'Reporting period'), h('select', { value: reportingPeriod, onChange: event => { setReportingPeriod(event.target.value); setReportPage(1); } },
                        h('option', { value: 'all' }, 'All reporting dates'), h('option', { value: '7' }, 'Last 7 days'), h('option', { value: '30' }, 'Last 30 days'), h('option', { value: '365' }, 'Last 12 months'))) : null,
                    activeTab === 'reports' ? h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', onClick: () => downloadCsv('management-dashboard-progress.csv', reportRows.progress), disabled: loading || !reportRows.progress.length }, h('i', { className: 'bi bi-cloud-arrow-down-fill' }), 'Export Dashboard') : null,
                    h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setRefreshCount(value => value + 1), disabled: loading, 'aria-label': 'Refresh dashboard data' }, h('i', { className: 'bi bi-arrow-clockwise' })))),
            errors.length ? h('div', { className: 'management-dashboard__errors', role: 'alert' }, errors.map(error => h('p', { key: error }, error))) : null,
            h('section', { className: 'management-dashboard__panel management-dashboard__panel--standalone', 'aria-label': pageTitle },
                activeTab === 'reports' ? h('section', { className: 'management-kpis', 'aria-label': 'Strategic planning summary' }, kpiCards) : null,
                pageContent),
            h('footer', { className: 'management-dashboard__footer' }, '© 2026 Strategic Planning Management System. All rights reserved.'))));
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading Management access…'));
apiRequest('/api/auth/me').then(payload => {
    const session = saveAccessSession(createAccessSession(payload.data));
    if (!enforcePageAccess()) return;
    if (!isManagementSession(session)) { window.location.replace('/access-denied'); return; }
    root.render(h(ManagementDashboard, { session }));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
