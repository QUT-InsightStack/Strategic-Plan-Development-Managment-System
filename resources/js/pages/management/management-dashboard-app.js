import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { listAllStrategicObjectives } from '../../api/strategic-objectives-api.js';
import { listAssignedPlanSubmissions, processPlanDecision } from '../../api/plan-approval-api.js';
import { listAllLocalMappings } from '../../mappings/mapping-storage.js';

enforcePageAccess();

const h = React.createElement;
const { useEffect, useMemo, useState } = React;

const tabs = [
    { id: 'progress', label: 'Progress Overview', icon: 'bi-speedometer2' },
    { id: 'alignment', label: 'Alignment', icon: 'bi-diagram-3-fill' },
    { id: 'reports', label: 'Reports', icon: 'bi-file-earmark-bar-graph-fill' },
    { id: 'pending', label: 'Pending Review', icon: 'bi-clock-history' },
];

function asList(payload) {
    return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
}

function progressValue(objective) {
    const value = Number(objective.progress_percentage ?? objective.progress ?? 0);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

function progressStatus(value) {
    if (value >= 100) return 'Completed';
    if (value > 0) return 'In Progress';
    return 'Not Started';
}

function statusClass(value) {
    if (value >= 100) return 'success';
    if (value > 0) return 'info';
    return 'neutral';
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatCard({ icon, label, value, detail, tone, onClick }) {
    return h('button', { className: `management-stat management-stat--${tone}`, type: 'button', onClick },
        h('span', { className: 'management-stat__icon', 'aria-hidden': 'true' }, h('i', { className: `bi ${icon}` })),
        h('span', { className: 'management-stat__copy' },
            h('small', null, label),
            h('strong', null, value),
            h('span', null, detail)
        )
    );
}

function EmptyState({ icon = 'bi-inbox', title, message }) {
    return h('div', { className: 'management-empty' },
        h('i', { className: `bi ${icon}`, 'aria-hidden': 'true' }),
        h('h3', null, title),
        h('p', null, message)
    );
}

function ProgressOverview({ objectives }) {
    const visible = objectives.slice(0, 12);
    return h('section', { className: 'ui-card management-panel', 'aria-labelledby': 'progress-heading' },
        h('div', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' }, h('h2', { id: 'progress-heading' }, 'Strategic Objective Progress'), h('p', null, 'Current progress across objectives and responsible offices.')),
            h('i', { className: 'bi bi-speedometer2', 'aria-hidden': 'true' })
        ),
        objectives.length
            ? h('div', { className: 'ui-table-wrap' }, h('table', { className: 'ui-table management-table' },
                h('thead', null, h('tr', null, ['Objective', 'Responsible Office / Unit', 'Progress', 'Status'].map(label => h('th', { key: label }, label)))),
                h('tbody', null, visible.map(objective => {
                    const progress = progressValue(objective);
                    return h('tr', { key: objective.objective_id },
                        h('td', null, h('strong', null, objective.objective_title || `Objective ${objective.objective_id}`)),
                        h('td', null, objective.responsible_office_agency || objective.responsible_unit?.unit_name || 'Unassigned'),
                        h('td', null, h('div', { className: 'management-progress' },
                            h('div', { className: 'management-progress__track' }, h('span', { style: { width: `${progress}%` } })),
                            h('strong', null, `${progress}%`)
                        )),
                        h('td', null, h('span', { className: `ui-badge ui-badge--${statusClass(progress)}` }, progressStatus(progress)))
                    );
                }))
            ))
            : h(EmptyState, { icon: 'bi-bullseye', title: 'No objectives available', message: 'Objective progress will appear here when Strategic Objectives are added.' })
    );
}

function AlignmentPanel({ mappings }) {
    return h('section', { className: 'ui-card management-panel', 'aria-labelledby': 'alignment-heading' },
        h('div', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' }, h('h2', { id: 'alignment-heading' }, 'Alignment Mapping'), h('p', null, 'Review Agenda → PDP → DOST → Agency relationships from the shared Mapping Module.')),
            h('i', { className: 'bi bi-diagram-3-fill', 'aria-hidden': 'true' })
        ),
        mappings.length
            ? h('div', { className: 'ui-table-wrap' }, h('table', { className: 'ui-table management-table' },
                h('thead', null, h('tr', null, ['Agenda', 'PDP Element', 'DOST Objective', 'Agency Plan / Input', 'Level'].map(label => h('th', { key: label }, label)))),
                h('tbody', null, mappings.map(mapping => h('tr', { key: mapping.id },
                    h('td', null, mapping.agenda_title || mapping.agenda_code || '—'),
                    h('td', null, mapping.pdp_chapter?.chapter_title || '—'),
                    h('td', null, mapping.dost_objective?.objective_title || '—'),
                    h('td', null, mapping.agency_objective?.objective_title || mapping.agency_input?.payload?.objective_title || mapping.agency_input?.payload?.content || '—'),
                    h('td', null, h('span', { className: `ui-badge ui-badge--${mapping.agency_office ? 'success' : 'info'}` }, mapping.agency_office ? 'Four level' : 'Three level'))
                )))
            ))
            : h(EmptyState, { icon: 'bi-diagram-3', title: 'No mappings available', message: 'Mappings created in the shared Mapping Module will appear here automatically.' })
    );
}

function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function downloadCsv(filename, columns, rows) {
    const content = [columns, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function ReportsPanel({ plans, objectives, mappings, reviews }) {
    const [preview, setPreview] = useState('plans');
    const reports = [
        { id: 'plans', icon: 'bi-file-earmark-text-fill', title: 'Strategic Plan Summary', detail: `${plans.length} plan records`, columns: ['Plan ID', 'Title', 'Status', 'Approval Status'], rows: plans.map(item => [item.record_id, item.title, item.status, item.approval_status || 'not_submitted']) },
        { id: 'progress', icon: 'bi-speedometer2', title: 'Objective Progress Summary', detail: `${objectives.length} objectives`, columns: ['Objective ID', 'Objective', 'Office / Unit', 'Progress', 'Status'], rows: objectives.map(item => { const progress = progressValue(item); return [item.objective_id, item.objective_title, item.responsible_office_agency || 'Unassigned', `${progress}%`, progressStatus(progress)]; }) },
        { id: 'alignment', icon: 'bi-diagram-3-fill', title: 'Alignment Report', detail: `${mappings.length} mappings`, columns: ['Agenda', 'PDP Element', 'DOST Objective', 'Agency'], rows: mappings.map(item => [item.agenda_title, item.pdp_chapter?.chapter_title, item.dost_objective?.objective_title, item.agency_office || '—']) },
        { id: 'approvals', icon: 'bi-clipboard-check-fill', title: 'Approval Summary', detail: `${reviews.length} pending reviews`, columns: ['Plan ID', 'Plan', 'Submitted By', 'Submitted At', 'Stage'], rows: reviews.map(item => [item.planId, item.plan_snapshot?.title, item.submittedBy, formatDate(item.submittedAt), item.currentStage?.name]) },
    ];
    const selected = reports.find(report => report.id === preview) || reports[0];

    return h(React.Fragment, null,
        h('section', { className: 'management-report-grid', 'aria-label': 'Report summaries' }, reports.map(report => h('article', { className: 'ui-card management-report-card', key: report.id },
            h('div', { className: 'management-report-card__heading' }, h('i', { className: `bi ${report.icon}`, 'aria-hidden': 'true' }), h('div', null, h('h3', null, report.title), h('p', null, report.detail))),
            h('div', { className: 'management-report-card__actions' },
                h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setPreview(report.id) }, h('i', { className: 'bi bi-eye' }), 'View Report'),
                h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', onClick: () => downloadCsv(`${report.id}-report.csv`, report.columns, report.rows) }, h('i', { className: 'bi bi-download' }), 'Export CSV')
            )
        ))),
        h('section', { className: 'ui-card management-panel management-report-preview' },
            h('div', { className: 'ui-section-header' }, h('div', { className: 'ui-section-header__copy' }, h('h2', null, selected.title), h('p', null, 'Preview updates inside this page.'))),
            selected.rows.length
                ? h('div', { className: 'ui-table-wrap' }, h('table', { className: 'ui-table management-table' }, h('thead', null, h('tr', null, selected.columns.map(column => h('th', { key: column }, column)))), h('tbody', null, selected.rows.slice(0, 10).map((row, index) => h('tr', { key: index }, row.map((cell, cellIndex) => h('td', { key: cellIndex }, cell || '—')))))))
                : h(EmptyState, { title: 'No report data available', message: 'This report will populate when matching records are available.' })
        )
    );
}

function DecisionDialog({ decision, reason, setReason, busy, error, onCancel, onConfirm }) {
    if (!decision) return null;
    const needsReason = decision.kind !== 'approve';
    const title = decision.kind === 'approve' ? 'Approve Strategic Plan' : decision.kind === 'return' ? 'Return Plan for Revision' : 'Reject Strategic Plan';
    return h('div', { className: 'management-dialog-backdrop', role: 'presentation' },
        h('section', { className: 'management-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'management-decision-title' },
            h('div', { className: `management-dialog__icon management-dialog__icon--${decision.kind}` }, h('i', { className: `bi ${decision.kind === 'approve' ? 'bi-check-lg' : 'bi-exclamation-lg'}` })),
            h('h2', { id: 'management-decision-title' }, title),
            h('p', null, decision.submission.plan_snapshot?.title || `Strategic Plan ${decision.submission.planId}`),
            h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, needsReason ? 'Reason *' : 'Approval comment (optional)'), h('textarea', { className: 'ui-textarea', rows: 4, value: reason, placeholder: needsReason ? 'Explain what must be revised or why the plan is rejected.' : 'Add an optional approval comment.', onChange: event => setReason(event.target.value) })),
            error ? h('p', { className: 'management-dialog__error', role: 'alert' }, error) : null,
            h('div', { className: 'management-dialog__actions' },
                h('button', { className: 'ui-button ui-button--secondary', type: 'button', disabled: busy, onClick: onCancel }, 'Cancel'),
                h('button', { className: `ui-button ${decision.kind === 'approve' ? 'ui-button--primary' : 'ui-button--danger'}`, type: 'button', disabled: busy, onClick: onConfirm }, busy ? 'Submitting…' : title)
            )
        )
    );
}

function PendingReviewPanel({ reviews, openDecision }) {
    return h('section', { className: 'ui-card management-panel', 'aria-labelledby': 'pending-heading' },
        h('div', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' }, h('h2', { id: 'pending-heading' }, 'Pending Review'), h('p', null, 'Strategic Plans currently assigned to you for a management decision.')),
            h('span', { className: 'ui-badge ui-badge--warning' }, `${reviews.length} pending`)
        ),
        reviews.length
            ? h('div', { className: 'ui-table-wrap' }, h('table', { className: 'ui-table management-table management-review-table' },
                h('thead', null, h('tr', null, ['Plan', 'Submitted By', 'Submitted Date', 'Current Stage', 'Actions'].map(label => h('th', { key: label }, label)))),
                h('tbody', null, reviews.map(submission => h('tr', { key: submission.id },
                    h('td', null, h('strong', null, submission.plan_snapshot?.title || `Strategic Plan ${submission.planId}`), h('small', null, `Plan ID ${submission.planId}`)),
                    h('td', null, submission.submittedBy || '—'),
                    h('td', null, formatDate(submission.submittedAt)),
                    h('td', null, h('span', { className: 'ui-badge ui-badge--warning' }, submission.currentStage?.name || 'Pending Review')),
                    h('td', null, h('div', { className: 'management-review-actions' },
                        h('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: `/strategic-plan-reviews/${submission.planId}` }, h('i', { className: 'bi bi-eye' }), 'Review Strategic Plan'),
                        h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', onClick: () => openDecision(submission, 'approve') }, 'Approve'),
                        h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => openDecision(submission, 'return') }, 'Return for Revision'),
                        h('button', { className: 'ui-button ui-button--danger ui-button--sm', type: 'button', onClick: () => openDecision(submission, 'reject') }, 'Reject')
                    ))
                )))
            ))
            : h(EmptyState, { icon: 'bi-clipboard-check', title: 'No plans pending review', message: 'New plans assigned to your approval stage will appear here.' })
    );
}

function ManagementDashboardApp() {
    const [activeTab, setActiveTab] = useState('progress');
    const [plans, setPlans] = useState([]);
    const [objectives, setObjectives] = useState([]);
    const [mappings, setMappings] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState({ type: '', message: '' });
    const [decision, setDecision] = useState(null);
    const [reason, setReason] = useState('');
    const [decisionError, setDecisionError] = useState('');
    const [busy, setBusy] = useState(false);

    async function loadDashboard() {
        setLoading(true);
        setNotice({ type: '', message: '' });
        const [planResult, objectiveResult, reviewResult] = await Promise.allSettled([
            listStrategicPlans({ per_page: 100 }),
            listAllStrategicObjectives({ per_page: 100 }),
            listAssignedPlanSubmissions(),
        ]);
        if (planResult.status === 'fulfilled') setPlans(asList(planResult.value));
        if (objectiveResult.status === 'fulfilled') setObjectives(asList(objectiveResult.value));
        if (reviewResult.status === 'fulfilled') setReviews(reviewResult.value);
        setMappings(listAllLocalMappings());
        const failures = [planResult, objectiveResult, reviewResult].filter(result => result.status === 'rejected').length;
        if (failures) setNotice({ type: 'error', message: `${failures} dashboard data source(s) could not be loaded. Available sections are still displayed.` });
        setLoading(false);
    }

    useEffect(() => { loadDashboard(); }, []);

    const summary = useMemo(() => {
        const completed = objectives.filter(item => progressValue(item) >= 100).length;
        const delayed = objectives.filter(item => ['delayed', 'overdue'].includes(String(item.progress_status || item.status || '').toLowerCase())).length;
        const assigned = objectives.filter(item => item.responsible_office_agency || item.responsible_unit_id || item.responsible_unit).length;
        return { completed, delayed, coverage: objectives.length ? Math.round((assigned / objectives.length) * 100) : 0 };
    }, [objectives]);

    function openDecision(submission, kind) {
        setDecision({ submission, kind });
        setReason('');
        setDecisionError('');
    }

    async function submitDecision() {
        if (!decision) return;
        if (decision.kind !== 'approve' && !reason.trim()) {
            setDecisionError('A reason is required before this decision can be submitted.');
            return;
        }
        setBusy(true);
        setDecisionError('');
        try {
            const isApproval = decision.kind === 'approve';
            const prefix = decision.kind === 'return' ? 'Return for Revision: ' : decision.kind === 'reject' ? 'Rejected: ' : '';
            await processPlanDecision({
                planId: decision.submission.planId,
                submission: decision.submission,
                decision: isApproval ? 'approve' : 'reject',
                comment: isApproval ? reason.trim() : `${prefix}${reason.trim()}`,
            });
            setReviews(current => current.filter(item => item.id !== decision.submission.id));
            setNotice({ type: 'success', message: isApproval ? 'Strategic Plan approved successfully.' : decision.kind === 'return' ? 'Strategic Plan returned for revision.' : 'Strategic Plan rejected.' });
            setDecision(null);
            setReason('');
        } catch (error) {
            setDecisionError(error.message || 'The decision could not be submitted.');
        } finally {
            setBusy(false);
        }
    }

    const panels = {
        progress: h(ProgressOverview, { objectives }),
        alignment: h(AlignmentPanel, { mappings }),
        reports: h(ReportsPanel, { plans, objectives, mappings, reviews }),
        pending: h(PendingReviewPanel, { reviews, openDecision }),
    };

    return h(React.Fragment, null,
        h(AppSidebar, { active: 'Home', onNotice: message => setNotice({ type: 'info', message }) }),
        h('main', { className: 'app-shell-main management-dashboard' },
            h('div', { className: 'app-shell-container management-dashboard__container' },
                h(PageHeader, {
                    section: 'Management',
                    title: 'Management Dashboard',
                    subtitle: 'Review strategic progress, alignment, reports, and plans awaiting a management decision.',
                    homeHref: '/management-dashboard',
                    actions: h('button', { className: 'ui-button ui-button--secondary', type: 'button', disabled: loading, onClick: loadDashboard }, h('i', { className: 'bi bi-arrow-clockwise' }), loading ? 'Loading…' : 'Refresh Dashboard'),
                }),
                notice.message ? h('div', { className: `ui-status ui-status--${notice.type}`, role: notice.type === 'error' ? 'alert' : 'status' }, notice.message) : null,
                h('section', { className: 'management-stats', 'aria-label': 'Management summary' },
                    h(StatCard, { icon: 'bi-file-earmark-text-fill', label: 'Total Strategic Plans', value: plans.length, detail: 'Across all agencies', tone: 'blue', onClick: () => setActiveTab('reports') }),
                    h(StatCard, { icon: 'bi-bullseye', label: 'Strategic Objectives', value: objectives.length, detail: 'In the current portfolio', tone: 'cyan', onClick: () => setActiveTab('progress') }),
                    h(StatCard, { icon: 'bi-check-lg', label: 'Completed Objectives', value: summary.completed, detail: '100% progress', tone: 'green', onClick: () => setActiveTab('progress') }),
                    h(StatCard, { icon: 'bi-hourglass-split', label: 'Delayed Objectives', value: summary.delayed, detail: 'Need attention', tone: 'red', onClick: () => setActiveTab('progress') }),
                    h(StatCard, { icon: 'bi-buildings-fill', label: 'Agency Coverage', value: `${summary.coverage}%`, detail: 'Objectives assigned', tone: 'purple', onClick: () => setActiveTab('alignment') })
                ),
                h('nav', { className: 'management-tabs', role: 'tablist', 'aria-label': 'Management dashboard sections' }, tabs.map(tab => h('button', {
                    key: tab.id,
                    id: `management-tab-${tab.id}`,
                    className: activeTab === tab.id ? 'is-active' : '',
                    type: 'button',
                    role: 'tab',
                    'aria-selected': activeTab === tab.id,
                    'aria-controls': `management-panel-${tab.id}`,
                    onClick: () => setActiveTab(tab.id),
                }, h('i', { className: `bi ${tab.icon}`, 'aria-hidden': 'true' }), tab.label, tab.id === 'pending' && reviews.length ? h('span', null, reviews.length) : null))),
                h('div', { id: `management-panel-${activeTab}`, role: 'tabpanel', 'aria-labelledby': `management-tab-${activeTab}`, className: 'management-tab-panel' }, loading ? h('div', { className: 'management-loading', role: 'status' }, h('span', null), 'Loading management data…') : panels[activeTab])
            )
        ),
        h(DecisionDialog, { decision, reason, setReason, busy, error: decisionError, onCancel: () => !busy && setDecision(null), onConfirm: submitDecision })
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(h(ManagementDashboardApp));
