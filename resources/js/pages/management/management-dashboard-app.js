import { AppSidebar } from '../../components/AppSidebar.js';
import { apiRequest } from '../../api/api-client.js';
import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { listAllStrategicObjectives } from '../../api/strategic-objectives-api.js';
import { listAssignedPlanSubmissions } from '../../api/plan-approval-api.js';
import { listSubmittedInputs } from '../../api/implementation-inputs-api.js';
import { createAccessSession, saveAccessSession, can } from '../../access/access-session.js';
import { PERMISSIONS as P } from '../../access/access-policy.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { ManagementReferenceDocuments } from './management-plan-review.js';

const h = React.createElement;
const roles = ['Management', 'Executive', 'Management / Executive'];
const tabs = [
    { id: 'dashboard', label: 'Progress Overview', permission: P.PLANS_VIEW },
    { id: 'alignment', label: 'Alignment Monitoring', permission: 'relations.view' },
    { id: 'reports', label: 'Reports & Summaries', permission: P.PLANS_VIEW },
    { id: 'pending', label: 'Pending Review', permission: P.PLANS_VIEW },
];
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
    const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
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
    const [activeTab, setActiveTab] = React.useState(tabs.some(tab => tab.id === queryTab && can(tab.permission, session)) ? queryTab : 'dashboard');
    const [alignmentSection, setAlignmentSection] = React.useState(new URLSearchParams(window.location.search).get('section') === 'documents' ? 'documents' : 'mapping');
    const [reportingPeriod, setReportingPeriod] = React.useState('all');
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

    function selectTab(tabId) {
        setActiveTab(tabId);
        const params = new URLSearchParams(window.location.search);
        params.set('tab', tabId);
        if (tabId !== 'alignment') params.delete('section');
        else { params.delete('section'); setAlignmentSection('mapping'); }
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }

    function selectAlignmentSection(section) {
        setAlignmentSection(section);
        const params = new URLSearchParams(window.location.search);
        params.set('tab', 'alignment');
        if (section === 'documents') params.set('section', 'documents'); else params.delete('section');
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }

    const filteredObjectives = objectives.filter(objective => withinPeriod(objective, reportingPeriod));
    const filteredPlans = plans;
    const filteredInputs = inputs;
    const completed = filteredObjectives.filter(item => objectiveStatus(item) === 'completed').length;
    const ongoing = filteredObjectives.filter(item => objectiveStatus(item) === 'in_progress').length;
    const alignedCount = filteredObjectives.filter(item => (item.presidential_agenda_items || []).length || (item.pdp_chapters || []).length).length;
    const alignmentCoverage = filteredObjectives.length ? Math.round(alignedCount * 100 / filteredObjectives.length) : 0;
    const plansById = new Map(filteredPlans.map(plan => [String(plan.record_id), plan]));
    const delayed = filteredObjectives.filter(objective => isDelayed(objective, plansById)).length;

    const progressByPlan = filteredPlans.map(plan => {
        const planObjectives = filteredObjectives.filter(item => Number(item.strategic_plan_id) === Number(plan.record_id));
        const counts = { completed: 0, in_progress: 0, not_started: 0 };
        planObjectives.forEach(item => { counts[objectiveStatus(item)] = (counts[objectiveStatus(item)] || 0) + 1; });
        const average = planObjectives.length ? Math.round(planObjectives.reduce((sum, item) => sum + percent(item), 0) / planObjectives.length) : 0;
        return { plan, objectives: planObjectives, counts, average };
    });

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
        { label: 'Alignment Coverage', value: loading ? '—' : `${alignmentCoverage}%`, detail: 'Strategic alignment', icon: 'bi-bullseye', tone: 'purple' },
    ];

    const tabButtons = tabs.filter(tab => can(tab.permission, session)).map(tab => h('button', {
        key: tab.id, type: 'button', role: 'tab', id: `management-tab-${tab.id}`,
        'aria-selected': activeTab === tab.id, 'aria-controls': 'management-tab-panel',
        className: `management-dashboard__tab${activeTab === tab.id ? ' is-active' : ''}`,
        onClick: () => selectTab(tab.id),
    }, tab.label));

    const kpiCards = kpis.map(card => h('article', { className: `management-kpi is-${card.tone}`, key: card.label },
        h('span', { className: 'management-kpi__icon' }, h('i', { className: `bi ${card.icon}`, 'aria-hidden': 'true' })),
        h('span', { className: 'management-kpi__copy' }, h('small', null, card.label), h('strong', null, card.value), h('span', null, card.detail))));

    const dashboardContent = h(React.Fragment, null,
        h('section', { className: 'management-card management-chart-card' },
            h('div', { className: 'management-card__heading' }, h('div', null, h('h2', null, 'Strategic Objective Progress'), h('p', null, 'Objective status distribution across plans you can access.'))),
            loading ? h('p', { className: 'management-empty' }, 'Loading progress data…') : progressByPlan.length ? h('div', { className: 'management-bars' }, progressByPlan.slice(0, 8).map(item => {
                const total = item.objectives.length || 1;
                return h('div', { className: 'management-bar-row', key: item.plan.record_id },
                    h('span', { className: 'management-bar-row__label', title: item.plan.title }, item.plan.title),
                    h('div', { className: 'management-bar' },
                        h('span', { className: 'is-completed', style: { width: `${item.counts.completed * 100 / total}%` } }),
                        h('span', { className: 'is-ongoing', style: { width: `${item.counts.in_progress * 100 / total}%` } }),
                        h('span', { className: 'is-not-started', style: { width: `${item.counts.not_started * 100 / total}%` } })),
                    h('strong', null, `${item.average}%`));
            })) : h('p', { className: 'management-empty' }, 'No objective progress is available for the selected plan.'),
            h('div', { className: 'management-legend' },
                [['is-completed', 'Completed'], ['is-ongoing', 'In Progress'], ['is-not-started', 'Not Started']].map(([tone, label]) => h('span', { key: tone }, h('i', { className: tone }), label)))),
        h('section', { className: 'management-card management-table-card' },
            h('div', { className: 'management-card__heading' }, h('div', null, h('h2', null, 'Progress Breakdown'), h('p', null, `${filteredPlans.length} plan(s) · ${filteredObjectives.length} objective(s)`))),
            h('div', { className: 'management-table-scroll' }, h('table', null,
                h('thead', null, h('tr', null, ['Strategic Plan', 'Objectives', 'Completed', 'In Progress', 'Not Started', 'Average Progress'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 6 }, 'Loading plan progress…')) : progressByPlan.length ? progressByPlan.map(item => h('tr', { key: item.plan.record_id },
                    h('td', null, item.plan.title), h('td', null, item.objectives.length), h('td', null, item.counts.completed), h('td', null, item.counts.in_progress), h('td', null, item.counts.not_started),
                    h('td', null, h('div', { className: 'management-progress-cell' }, h('span', null, `${item.average}%`), h('span', { className: 'management-progress-track' }, h('i', { style: { width: `${item.average}%` } })))))) : h('tr', null, h('td', { colSpan: 6 }, 'No strategic plans found.')))))));

    const alignmentMappingContent = h('section', { className: 'management-card management-table-card' },
        h('div', { className: 'management-card__heading' }, h('div', null, h('h2', null, 'Agenda / PDP Alignment'), h('p', null, 'Presidential Agenda → PDP Chapter → Strategic Objective → Responsible Agency')),
            h('div', { className: 'management-card__actions' },
                h('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: '/mappings?mode=view' }, 'Open Mapping View'),
                can(P.INPUTS_VIEW, session) ? h('a', { className: 'ui-button ui-button--primary ui-button--sm', href: '/consolidate-inputs' }, 'Agency Input Review') : null)),
        h('div', { className: 'management-table-scroll' }, h('table', null,
            h('thead', null, h('tr', null, ['Presidential Agenda', 'PDP Chapter', 'Strategic Objective', 'Agency / Office', 'Progress', 'Status'].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 6 }, 'Loading alignment data…')) : filteredObjectives.length ? filteredObjectives.map(item => {
                const status = objectiveStatus(item);
                const agenda = labelFor(item.presidential_agenda_items, ['title', 'item_title', 'agenda_title', 'name']);
                const chapter = labelFor(item.pdp_chapters, ['chapter_title', 'title', 'name']);
                const office = item.responsible_unit_assignment?.responsible_unit?.name || item.responsible_office_agency || 'Unassigned';
                return h('tr', { key: item.objective_id }, h('td', null, agenda), h('td', null, chapter), h('td', null, item.objective_title), h('td', null, office),
                    h('td', null, h('div', { className: 'management-progress-cell' }, h('span', null, `${percent(item)}%`), h('span', { className: 'management-progress-track' }, h('i', { style: { width: `${percent(item)}%` } })))),
                    h('td', null, h('span', { className: `management-status is-${status}` }, statusLabels[status] || status)));
            }) : h('tr', null, h('td', { colSpan: 6 }, 'No strategic objectives are available.'))))));

    const alignmentContent = h(React.Fragment, null,
        h('nav', { className: 'management-alignment-sections', 'aria-label': 'Alignment review sections' },
            h('button', { type: 'button', className: `management-alignment-sections__item${alignmentSection === 'mapping' ? ' is-active' : ''}`, onClick: () => selectAlignmentSection('mapping') }, 'Agenda / PDP Alignment'),
            can(P.INPUTS_VIEW, session) ? h('a', { className: 'management-alignment-sections__item', href: '/consolidate-inputs' }, 'Agency Input') : null,
            can('strategic_documents.view', session) ? h('button', { type: 'button', className: `management-alignment-sections__item${alignmentSection === 'documents' ? ' is-active' : ''}`, onClick: () => selectAlignmentSection('documents') }, 'Reference Documents') : null),
        alignmentSection === 'documents' ? h(ManagementReferenceDocuments, { plans }) : alignmentMappingContent);

    const reports = [
        { id: 'plans', title: 'Strategic Plan Register', description: 'Plan title, lifecycle status and planning period.', icon: 'bi-journal-text', count: plans.length, label: 'plans', rows: reportRows.plans },
        { id: 'progress', title: 'Objective Progress Summary', description: 'Progress percentage, calculated status, responsible office and last update.', icon: 'bi-graph-up', count: filteredObjectives.length, label: 'objectives', rows: reportRows.progress },
        { id: 'alignment', title: 'Strategic Alignment Report', description: 'Agenda, PDP chapter, objective and responsible agency mappings.', icon: 'bi-diagram-3', count: filteredObjectives.length, label: 'objective mappings', rows: reportRows.alignment },
        { id: 'inputs', title: 'Agency Input Report', description: 'Submitted agency implementation updates, review status and submission date.', icon: 'bi-building-check', count: filteredInputs.length, label: 'agency inputs', rows: reportRows.inputs },
        { id: 'reviews', title: 'Assigned Approval Queue', description: 'Plan approvals assigned to your account and their current workflow stage.', icon: 'bi-clipboard-check', count: reviews.length, label: 'pending reviews', rows: reportRows.reviews },
    ];
    const reportsContent = h('section', { className: 'management-report-grid', 'aria-label': 'Reports and summaries' }, reports.filter(report => report.id !== 'inputs' || can(P.INPUTS_VIEW, session)).map(report => h('article', { className: 'management-card management-report-card', key: report.id },
        h('span', { className: 'management-report-card__icon' }, h('i', { className: `bi ${report.icon}` })),
        h('div', null, h('h2', null, report.title), h('p', null, report.description), h('small', null, `${loading ? '—' : report.count} ${report.label}`)),
        h('div', { className: 'management-report-card__actions' },
            h('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: report.id === 'inputs' ? '/consolidate-inputs' : report.id === 'alignment' ? '/mappings?mode=view' : report.id === 'reviews' ? '/strategic-plan-reviews' : report.id === 'plans' ? '/strategic-plans' : '/office?view=progress' }, 'View'),
            h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', disabled: loading || !report.rows.length, onClick: () => downloadCsv(`${report.id}-report.csv`, report.rows) }, 'Export CSV')))));

    const pendingContent = h('section', { className: 'management-card management-table-card' },
        h('div', { className: 'management-card__heading' }, h('div', null, h('h2', null, 'Approval List'), h('p', null, 'Approval items currently assigned to your account.')),
            h('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: '/strategic-plan-reviews' }, 'Open Review List')),
        h('div', { className: 'management-table-scroll' }, h('table', null,
            h('thead', null, h('tr', null, ['Strategic Plan', 'Workflow Stage', 'Submitted', 'Action'].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 4 }, 'Loading assigned reviews…')) : reviews.length ? reviews.map(item => h('tr', { key: item.id },
                h('td', null, item.plan_snapshot?.title || `Strategic Plan ${item.planId}`), h('td', null, item.currentStage?.name || 'Awaiting assignment'), h('td', null, formatDate(item.submittedAt)),
                h('td', null, h('a', { className: 'ui-button ui-button--primary ui-button--sm', href: `/strategic-plan-reviews/${item.planId}` }, 'Review')))) : h('tr', null, h('td', { colSpan: 4 }, 'No plans are currently assigned to you for review.'))))));

    const contentByTab = { dashboard: dashboardContent, alignment: alignmentContent, reports: reportsContent, pending: pendingContent };

    return h('div', { className: 'app-shell management-dashboard' },
        h(AppSidebar),
        h('main', { className: 'app-shell-main' }, h('div', { className: 'management-dashboard__content' },
            h('header', { className: 'management-dashboard__header' },
                h('div', null, h('p', { className: 'management-dashboard__eyebrow' }, 'Management / Executive'), h('h1', null, 'Management Dashboard'), h('p', null, `Welcome, ${session.name || 'Management'}. Monitor plan delivery, alignments and assigned approvals.`)),
                h('div', { className: 'management-dashboard__controls' },
                    h('label', null, h('span', null, 'Reporting period'), h('select', { value: reportingPeriod, onChange: event => setReportingPeriod(event.target.value) },
                        h('option', { value: 'all' }, 'All reporting dates'), h('option', { value: '7' }, 'Last 7 days'), h('option', { value: '30' }, 'Last 30 days'), h('option', { value: '365' }, 'Last 12 months'))),
                    h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', onClick: () => downloadCsv('management-dashboard-progress.csv', reportRows.progress), disabled: loading || !reportRows.progress.length }, h('i', { className: 'bi bi-cloud-arrow-down-fill' }), 'Export Dashboard'),
                    h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setRefreshCount(value => value + 1), disabled: loading, 'aria-label': 'Refresh dashboard data' }, h('i', { className: 'bi bi-arrow-clockwise' })))),
            errors.length ? h('div', { className: 'management-dashboard__errors', role: 'alert' }, errors.map(error => h('p', { key: error }, error))) : null,
            h('section', { className: 'management-kpis', 'aria-label': 'Strategic planning summary' }, kpiCards),
            h('nav', { className: 'management-dashboard__tabs', role: 'tablist', 'aria-label': 'Management dashboard sections' }, tabButtons),
            h('section', { id: 'management-tab-panel', role: 'tabpanel', 'aria-labelledby': `management-tab-${activeTab}`, className: 'management-dashboard__panel' }, contentByTab[activeTab] || dashboardContent),
            h('footer', { className: 'management-dashboard__footer' }, '© 2026 Strategic Planning Management System. All rights reserved.'))));
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading Management access…'));
apiRequest('/api/auth/me').then(payload => {
    const session = saveAccessSession(createAccessSession(payload.data));
    if (!roles.includes(session.roleName)) { window.location.replace('/access-denied'); return; }
    if (enforcePageAccess()) root.render(h(ManagementDashboard, { session }));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
