import { getStrategicPlan } from '../../api/strategic-plans-api.js';
import { listStrategicObjectives } from '../../api/strategic-objectives-api.js';
import { ManagementPagination, pageRows } from '../../components/ManagementPagination.js';
import { planMatchesFilters } from './management-insights.js';
import { managementDateLabel } from './management-data.js';
import { ManagementObjectiveCommentsPanel } from '../../components/ManagementObjectiveCommentsPanel.js';
import { can } from '../../access/access-session.js';

const h = React.createElement;
const { useEffect, useState } = React;

const dateLabel = value => managementDateLabel(value, 'Not provided');
function field(label, value) {
    return h('div', { className: 'office-summary-field', key: label }, h('dt', null, label), h('dd', null, value || 'Not provided'));
}

export function ManagementPlanReview({ plans, planId, filters = {}, onOpenPlan, onBack }) {
    const [plan, setPlan] = useState(null);
    const [objectives, setObjectives] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [objectivePage, setObjectivePage] = useState(1);

    useEffect(() => {
        if (!planId) { setPlan(null); setObjectives([]); setError(''); return undefined; }
        let active = true;
        setPlan(null); setObjectives([]);
        setLoading(true); setError('');
        setObjectivePage(1);
        Promise.all([getStrategicPlan(planId), listStrategicObjectives(planId)])
            .then(([planPayload, objectivePayload]) => {
                if (!active) return;
                if (
    !planPayload.data
    || !['draft', 'finished'].includes(planPayload.data.status)
) {
    throw new Error('This plan is unavailable for viewing and objective comments.');
}
                setPlan(planPayload.data);
                setObjectives((objectivePayload.data || []).filter(item => !['archived', 'deleted'].includes(item.status)));
            })
            .catch(reason => { if (active) setError(reason.message || 'Unable to load plan details.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [planId]);

    const visiblePlans = plans.filter(item => `${item.record_id} ${item.title || ''} ${item.department_agency || ''}`.toLowerCase().includes(search.trim().toLowerCase())
        && planMatchesFilters(item, filters) && (!filters.office || item.department_agency === filters.office));
    useEffect(() => { setPage(1); }, [JSON.stringify(filters)]);
    if (!planId) return h('section', { className: 'management-card management-table-card' },
        h('div', { className: 'management-card__heading' }, h('div', null,
            h('h2', null, 'Strategic Plans and Objective Comments'),
            h('p', null, 'View draft and finalized plans and provide comments on their objectives. Approval decisions are handled separately.')),
            h('label', { className: 'management-approvals__search' }, h('span', null, 'Search plans'), h('input', { type: 'search', value: search, onChange: event => { setSearch(event.target.value); setPage(1); }, placeholder: 'Plan title, ID or agency' }))),
        h('div', { className: 'management-table-scroll' }, h('table', null,
            h('thead', null, h('tr', null, ['Plan ID', 'Strategic Plan', 'Department / Agency', 'Period', 'Status', 'Action'].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, visiblePlans.length ? pageRows(visiblePlans, page).map(item => h('tr', { key: item.record_id },
                h('td', null, item.record_id), h('td', null, item.title), h('td', null, item.department_agency || '—'),
                h('td', null, `${dateLabel(item.planning_start_date)} – ${dateLabel(item.planning_end_date)}`), h('td', null, item.planning_status_label || item.status || '—'),
                h('td', null, h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => onOpenPlan(item.record_id) }, 'View summary'))))
                : h('tr', null, h('td', { colSpan: 6 }, plans.length ? 'No plans match the current filters.' : 'No data in your authorised scope.'))))),
        h(ManagementPagination, { page, total: visiblePlans.length, onChange: setPage, label: 'plans' }),
        h('p', { className: 'management-plan-review__count' }, `${visiblePlans.length} of ${plans.length} plan(s)`));

    const author = plan?.creator?.name || [plan?.creator?.first_name, plan?.creator?.last_name].filter(Boolean).join(' ');
    const objectiveRows = objectives.length ? pageRows(objectives, objectivePage).map((objective, index) => {
        const progress = Math.max(0, Math.min(100, Number(objective.progress_percentage) || 0));
        return h('tr', { key: objective.objective_id }, h('td', null, (objectivePage - 1) * 10 + index + 1), h('td', null, objective.objective_title || objective.objective_description || '—'),
            ...['expected_outcome', 'indicator', 'target', 'responsible_office_agency'].map(key => h('td', { key }, objective[key] || '—')),
            h('td', null, `${progress}% · ${progress === 100 ? 'Completed' : progress > 0 ? 'In Progress' : 'Not Started'}`));
    }) : h('tr', null, h('td', { colSpan: 7 }, 'No strategic objectives have been added to this plan.'));
    const detail = plan && !loading ? h('article', { className: 'office-panel office-detail-panel' },
        h('section', { 'aria-labelledby': 'management-plan-summary-title' },
            h('div', { className: 'office-plan-toolbar' }, h('h2', { id: 'management-plan-summary-title' }, 'Plan Summary'), h('span', { className: 'management-plan-review__status' }, plan.planning_status_label || plan.status || '—')),
            h('dl', { className: 'office-summary-grid' },
                field('Plan ID', plan.record_id), field('Plan Title', plan.title),
                field('Plan period', plan.planning_start_date && plan.planning_end_date ? `${dateLabel(plan.planning_start_date)} – ${dateLabel(plan.planning_end_date)}` : null),
                field('Department / Agency', plan.department_agency), field('Last Updated', dateLabel(plan.updated_at))),
            author ? h('p', { className: 'office-muted' }, `Created by ${author}`) : null,
            h('dl', { className: 'office-foundations' },
                field('Mission', plan.mission_foundation?.content), field('Vision', plan.vision_foundation?.content),
                field('Core Values', plan.core_values?.length ? h('ul', null, plan.core_values.map((value, index) => h('li', { key: value.foundation_id || index }, value.content))) : null))),
        h('section', { className: 'office-detail-objectives', 'aria-labelledby': 'management-objectives-title' },
            h('h2', { id: 'management-objectives-title' }, 'Strategic Objectives'),
            h('div', { className: 'office-table-scroll' }, h('table', null,
                h('thead', null, h('tr', null, ['No.', 'Objective', 'Expected outcome', 'Indicator', 'Target', 'Responsible Office / Agency', 'Progress'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                h('tbody', null, objectiveRows))),
            h(ManagementPagination, { page: objectivePage, total: objectives.length, onChange: setObjectivePage, label: 'objectives' })),
            can('management_objective_comments.view') && h(
    ManagementObjectiveCommentsPanel,
    {
        key: `management-comments-${planId}`,
        planId,
        objectives,
    }
),
            ) : null;
    return h('div', { className: 'management-plan-review' },
        h('button', { className: 'ui-button ui-button--secondary ui-button--sm management-plan-review__back', type: 'button', onClick: onBack }, h('i', { className: 'bi bi-chevron-left', 'aria-hidden': true }), ' Back to plans'),
        loading ? h('p', { role: 'status' }, 'Loading plan review…') : null,
        error ? h('div', { className: 'management-dashboard__errors', role: 'alert' }, error) : null,
        detail);
}
