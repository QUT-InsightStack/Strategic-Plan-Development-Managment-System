import { ManagementPagination, pageRows } from '../../components/ManagementPagination.js';
import { officeName, objectiveRisk, periodLabel, progressPercent, progressStatus } from './management-insights.js';
import { managementDateLabel } from './management-data.js';

const h = (...args) => React.createElement(...args);

export const CHART_SERIES = [
    { key: 'completed', label: 'Completed', tone: 'completed' },
    { key: 'ongoing', label: 'Ongoing', tone: 'in_progress' },
    { key: 'not_started', label: 'Not Started', tone: 'not_started' },
    { key: 'delayed', label: 'Delayed', tone: 'overdue' },
];

function chartDescription(years, period) {
    return `Six-year implementation progress for ${periodLabel(period)}. ` + years.map(row => row.future
        ? `${row.label} (${row.year}): not yet reached.`
        : `${row.label} (${row.year}): ${CHART_SERIES.map(series => `${row[series.key]} ${series.label.toLowerCase()}`).join(', ')}.`).join(' ');
}

// Stacked bars drawn as inline SVG; the breakdown table below is the accessible equivalent.
export function SixYearChart({ years, period }) {
    const width = 640;
    const height = 240;
    const left = 36;
    const bottom = 34;
    const top = 12;
    const plotHeight = height - top - bottom;
    const max = Math.max(1, ...years.map(row => row.total));
    const step = Math.max(1, Math.ceil(max / 4));
    const scaleMax = step * 4;
    const slot = (width - left - 8) / Math.max(years.length, 1);
    const barWidth = Math.min(56, slot * 0.55);
    return h('figure', { className: 'management-six-year__figure' },
        h('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': chartDescription(years, period), className: 'management-six-year__chart', preserveAspectRatio: 'xMidYMid meet' },
            [0, 1, 2, 3, 4].map(index => {
                const value = step * index;
                const y = top + plotHeight - (value / scaleMax) * plotHeight;
                return h('g', { key: index, 'aria-hidden': true },
                    h('line', { x1: left, x2: width - 8, y1: y, y2: y, className: 'management-six-year__grid' }),
                    h('text', { x: left - 8, y: y + 4, textAnchor: 'end', className: 'management-six-year__tick' }, value));
            }),
            years.map((row, index) => {
                const x = left + slot * index + (slot - barWidth) / 2;
                let offset = top + plotHeight;
                return h('g', { key: row.year, 'aria-hidden': true },
                    row.future ? h('text', { x: x + barWidth / 2, y: top + plotHeight - 8, textAnchor: 'middle', className: 'management-six-year__future' }, 'Not yet')
                        : CHART_SERIES.map(series => {
                            const size = (row[series.key] / scaleMax) * plotHeight;
                            if (!size) return null;
                            offset -= size;
                            return h('rect', { key: series.key, x, y: offset, width: barWidth, height: size, className: `management-six-year__bar progress-tone-${series.tone}` },
                                h('title', null, `${row.label}: ${row[series.key]} ${series.label.toLowerCase()}`));
                        }),
                    h('text', { x: x + barWidth / 2, y: height - 18, textAnchor: 'middle', className: 'management-six-year__label' }, row.label),
                    h('text', { x: x + barWidth / 2, y: height - 4, textAnchor: 'middle', className: 'management-six-year__year' }, row.year));
            })),
        h('figcaption', { className: 'management-progress-legend', 'aria-hidden': true }, CHART_SERIES.map(series =>
            h('span', { key: series.key, className: `progress-tone-${series.tone}` }, h('i'), series.label))));
}

export function ProgressBreakdownTable({ years }) {
    return h('div', { className: 'management-table-scroll' }, h('table', null,
        h('caption', { className: 'ui-visually-hidden' }, 'Progress breakdown by plan year'),
        h('thead', null, h('tr', null, ['Year', ...CHART_SERIES.map(series => series.label), 'Total'].map(label => h('th', { key: label, scope: 'col' }, label)))),
        h('tbody', null, years.map(row => h('tr', { key: row.year },
            h('th', { scope: 'row' }, `${row.label} (${row.year})`),
            ...CHART_SERIES.map(series => h('td', { key: series.key }, row.future ? '—' : row[series.key])),
            h('td', null, row.future ? 'Not yet reached' : h('strong', null, row.total)))))));
}

export function OfficePerformanceTable({ rows, showInputs, compact = false }) {
    const [page, setPage] = React.useState(1);
    React.useEffect(() => { setPage(1); }, [rows.length]);
    const columns = ['Office / Unit', 'Objectives', 'Completion', 'Alignment coverage', ...(showInputs ? ['Inputs submitted', 'Inputs pending'] : []), 'Overdue'];
    const size = compact ? 5 : 10;
    return h(React.Fragment, null,
        h('div', { className: 'management-table-scroll' }, h('table', null,
            h('thead', null, h('tr', null, columns.map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, pageRows(rows, page, size).map(row => h('tr', { key: row.office },
                h('th', { scope: 'row' }, row.office), h('td', null, row.objectives),
                h('td', null, meter(row.completion_percent, `${row.office} completion`)),
                h('td', null, meter(row.alignment_percent, `${row.office} alignment coverage`)),
                showInputs ? h('td', null, row.inputs_submitted) : null,
                showInputs ? h('td', null, row.inputs_pending) : null,
                h('td', null, row.overdue ? h('span', { className: 'management-status is-overdue' }, row.overdue) : 0)))))),
        h(ManagementPagination, { page, total: rows.length, pageSize: size, label: 'offices', onChange: setPage }));
}

function meter(percent, label) {
    return h('span', { className: 'management-progress-cell' }, h('span', null, `${percent}%`),
        h('span', { className: 'management-progress-track', role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent },
            h('i', { style: { width: `${percent}%` } })));
}

function attentionList({ title, icon, tone, items, total, emptyText, action }) {
    return h('article', { className: `management-attention__group is-${tone}` },
        h('h3', null, h('i', { className: `bi ${icon}`, 'aria-hidden': true }), ` ${title} `, h('span', { className: 'management-attention__count' }, total)),
        items.length ? h('ul', null, items.map(item => h('li', { key: item.key }, h('strong', null, item.title), h('span', null, item.detail))))
            : h('p', { className: 'management-empty' }, emptyText),
        total > items.length && action ? h('button', { className: 'management-link-button', type: 'button', onClick: action.onClick }, action.label) : null);
}

export function AttentionRequired({ overdue, missingLinks, pendingInputs, inputsState, onShowOverdue, onOpenTab }) {
    const top = rows => rows.slice(0, 4);
    return h('div', { className: 'management-attention' },
        attentionList({ title: 'Overdue objectives', icon: 'bi-hourglass-split', tone: 'overdue', total: overdue.length, emptyText: 'No overdue objectives.',
            items: top(overdue).map(({ objective, plan }) => ({ key: objective.objective_id, title: objective.objective_title || `Objective ${objective.objective_id}`, detail: `${officeName(objective)} · plan ended ${managementDateLabel(plan?.planning_end_date)}` })),
            action: { label: `Show all ${overdue.length} overdue`, onClick: onShowOverdue } }),
        attentionList({ title: 'Missing Agenda / PDP links', icon: 'bi-link-45deg', tone: 'pending', total: missingLinks.length, emptyText: 'Every objective is linked to the Agenda and a PDP chapter.',
            items: top(missingLinks).map(objective => ({ key: objective.objective_id, title: objective.objective_title || `Objective ${objective.objective_id}`,
                detail: `Missing ${[!(objective.presidential_agenda_items || []).length && 'Agenda', !(objective.pdp_chapters || []).length && 'PDP'].filter(Boolean).join(' and ')}` })),
            action: { label: 'Open Alignment & Performance', onClick: () => onOpenTab('alignment') } }),
        inputsState === 'forbidden' ? h('article', { className: 'management-attention__group' }, h('h3', null, h('i', { className: 'bi bi-inboxes', 'aria-hidden': true }), ' Pending inputs'),
            h('p', { className: 'management-empty' }, 'You do not have permission to view submitted inputs.'))
            : attentionList({ title: 'Pending inputs', icon: 'bi-inboxes', tone: 'in_progress', total: pendingInputs.length, emptyText: 'No inputs are waiting for review.',
                items: top(pendingInputs).map(input => ({ key: input.input_id, title: input.objective?.objective_title || input.strategic_plan?.title || 'Plan-level input', detail: `${input.responsible_office_agency || 'Unassigned'} · submitted ${managementDateLabel(input.submitted_at)}` })),
                action: { label: 'Open Inputs & Consolidation', onClick: () => onOpenTab('inputs') } }));
}

export function PendingActions({ actions }) {
    if (!actions.length) return h('p', { className: 'management-empty' }, h('i', { className: 'bi bi-check2-circle', 'aria-hidden': true }), ' No pending actions.');
    return h('ul', { className: 'management-actions-list' }, actions.map(review => h('li', { key: review.id || review.planId },
        h('div', null, h('strong', null, review.plan_snapshot?.title || `Strategic Plan ${review.planId}`),
            h('span', null, `${review.currentStage?.name || 'Current stage'} · submitted ${managementDateLabel(review.submittedAt)}`)),
        h('a', { className: 'ui-button ui-button--primary ui-button--sm', href: `/strategic-plan-reviews/${review.planId}` }, 'Review / decide'))));
}

const progressLabels = { completed: 'Completed', in_progress: 'Ongoing', not_started: 'Not Started', overdue: 'Overdue / Delayed' };

// Per-plan status distribution with an expandable objective list (the existing monitoring view).
export function PlanProgressMonitor({ items }) {
    const [planSearch, setPlanSearch] = React.useState('');
    const [planPage, setPlanPage] = React.useState(1);
    const [objectivePage, setObjectivePage] = React.useState(1);
    const [selectedPlanId, setSelectedPlanId] = React.useState('');
    React.useEffect(() => { setPlanPage(1); setSelectedPlanId(''); }, [items.length]);
    const visible = items.filter(item => !planSearch.trim()
        || `${item.plan.record_id} ${item.plan.title || ''} ${item.plan.department_agency || ''}`.toLowerCase().includes(planSearch.trim().toLowerCase()));
    const stateOf = (objective, plan) => objectiveRisk(objective, plan) === 'Overdue' ? 'overdue' : progressStatus(objective);
    return h(React.Fragment, null,
        h('div', { className: 'management-monitor-toolbar' },
            h('div', { className: 'management-progress-legend', 'aria-label': 'Objective status legend' }, Object.entries(progressLabels).map(([status, label]) =>
                h('span', { key: status, className: `progress-tone-${status}` }, h('i', { 'aria-hidden': true }), label))),
            h('label', { className: 'management-approvals__search' }, h('span', null, 'Find a plan'), h('input', { type: 'search', value: planSearch, placeholder: 'Plan title, ID or agency',
                onChange: event => { setPlanSearch(event.target.value); setPlanPage(1); setSelectedPlanId(''); } }))),
        !visible.length ? h('p', { className: 'management-empty' }, 'No plans match this search.')
            : h('div', { className: 'management-progress-plans' }, pageRows(visible, planPage, 5).map(item => {
                const expanded = selectedPlanId === String(item.plan.record_id);
                const total = item.objectives.length;
                const counts = { completed: 0, in_progress: 0, not_started: 0, overdue: 0 };
                item.objectives.forEach(objective => { counts[stateOf(objective, item.plan)] += 1; });
                return h('article', { key: item.plan.record_id, className: 'management-progress-plan' },
                    h('div', { className: 'management-progress-plan__heading' },
                        h('div', { className: 'management-progress-plan__copy' },
                            h('div', { className: 'management-progress-plan__meta' }, h('span', null, `Plan ${item.plan.record_id}`), item.plan.department_agency && h('span', null, item.plan.department_agency)),
                            h('h3', null, item.plan.title),
                            h('p', null, h('span', null, 'Planning period'), ' ', `${managementDateLabel(item.plan.planning_start_date)} – ${managementDateLabel(item.plan.planning_end_date)}`)),
                        h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', 'aria-expanded': expanded, 'aria-controls': `monitor-objectives-${item.plan.record_id}`,
                            onClick: () => { setSelectedPlanId(expanded ? '' : String(item.plan.record_id)); setObjectivePage(1); } }, expanded ? 'Hide objectives' : `View objectives (${total})`)),
                    h('div', { className: 'management-progress-plan__status' },
                        h('div', { className: 'management-progress-counts' },
                            Object.keys(counts).map(status => h('span', { className: `progress-tone-${status}`, key: status }, h('strong', null, counts[status]), ` ${progressLabels[status]}`))),
                        total > 0 && h('div', { className: 'management-plan-status-bar', role: 'img', 'aria-label': Object.keys(counts).map(status => `${counts[status]} ${progressLabels[status].toLowerCase()}`).join(', ') },
                            Object.keys(counts).map(status => counts[status] ? h('span', { key: status, className: `progress-tone-${status}`, style: { width: `${counts[status] * 100 / total}%` } }) : null))),
                    expanded && h('div', { id: `monitor-objectives-${item.plan.record_id}`, className: 'management-objective-cards' },
                        !total ? h('p', { className: 'management-empty' }, 'No objectives match the current filters for this plan.') : pageRows(item.objectives, objectivePage, 6).map(objective => {
                            const percent = progressPercent(objective);
                            const status = stateOf(objective, item.plan);
                            return h('article', { key: objective.objective_id, className: `management-objective-card progress-tone-${status}` },
                                h('div', { className: 'management-objective-card__heading' }, h('h4', null, objective.objective_title || `Objective ${objective.objective_id}`),
                                    h('span', { className: 'management-objective-badge' }, progressLabels[status])),
                                h('p', { className: 'management-objective-owner' }, h('i', { className: 'bi bi-building', 'aria-hidden': true }), ' Responsible Office / Unit: ', h('strong', null, officeName(objective))),
                                h('div', { className: 'management-objective-meter-label' }, h('span', null, 'Progress'), h('strong', null, `${percent}%`)),
                                h('div', { className: 'management-objective-meter', role: 'progressbar', 'aria-label': `${objective.objective_title || 'Objective'} progress`, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': percent, 'aria-valuetext': `${percent}% — ${progressLabels[status]}` },
                                    h('span', { style: { width: `${percent}%` } })),
                                h('small', { className: 'management-objective-updated' }, `Last updated: ${managementDateLabel(objective.progress_updated_at, 'No progress update yet')}`));
                        }),
                        total > 0 && h(ManagementPagination, { page: objectivePage, total, pageSize: 6, label: 'objectives', onChange: setObjectivePage })));
            })),
        h(ManagementPagination, { page: planPage, total: visible.length, pageSize: 5, label: 'plans', onChange: next => { setPlanPage(next); setSelectedPlanId(''); } }));
}
