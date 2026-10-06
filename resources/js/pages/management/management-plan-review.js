import { getStrategicPlan, listStrategicPlanComments, addStrategicPlanComment } from '../../api/strategic-plans-api.js';
import { listStrategicObjectives } from '../../api/strategic-objectives-api.js';
import { ManagementPagination, pageRows } from '../../components/ManagementPagination.js';
import { planningYears } from './management-insights.js';
import { loadAllManagementPages, managementDateLabel } from './management-data.js';

const h = React.createElement;
const { useEffect, useState } = React;

const dateLabel = value => managementDateLabel(value, 'Not provided');
function field(label, value) {
    return h('div', { className: 'office-summary-field', key: label }, h('dt', null, label), h('dd', null, value || 'Not provided'));
}

export function ManagementPlanReview({ plans, planId, mode = 'plans', canComment = false, onOpenPlan, onBack }) {
    const [plan, setPlan] = useState(null);
    const [objectives, setObjectives] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState('');
    const [commentError, setCommentError] = useState('');
    const [savingComment, setSavingComment] = useState(false);
    const [search, setSearch] = useState('');
    const [year, setYear] = useState('');
    const [office, setOffice] = useState('');
    const [status, setStatus] = useState('');
    const [approvalStatus, setApprovalStatus] = useState('');
    const [page, setPage] = useState(1);
    const [objectivePage, setObjectivePage] = useState(1);

    useEffect(() => {
        if (!planId) { setPlan(null); setObjectives([]); setError(''); return undefined; }
        let active = true;
        setLoading(true); setError('');
        setComments([]); setCommentError(''); setCommentText('');
        setObjectivePage(1);
        Promise.all([getStrategicPlan(planId), listStrategicObjectives(planId)])
            .then(([planPayload, objectivePayload]) => {
                if (!active) return;
                setPlan(planPayload.data);
                setObjectives(objectivePayload.data || []);
            })
            .catch(reason => { if (active) setError(reason.message || 'Unable to load plan details.'); })
            .finally(() => { if (active) setLoading(false); });
        if (canComment) loadAllManagementPages(params => listStrategicPlanComments(planId, params)).then(rows => {
            if (active) setComments(rows);
        }).catch(reason => { if (active) setCommentError(reason.message || 'Comments could not be loaded.'); });
        return () => { active = false; };
    }, [planId, canComment]);

    async function submitComment(event) {
        event.preventDefault();
        const content = commentText.trim();
        if (!content || !canComment || savingComment) return;
        setSavingComment(true);
        setCommentError('');
        try {
            const payload = await addStrategicPlanComment(planId, content);
            setComments(rows => [...rows, payload.data]);
            setCommentText('');
        } catch (reason) {
            setCommentError(reason.message || 'Comment could not be saved.');
        } finally {
            setSavingComment(false);
        }
    }

    const visiblePlans = plans.filter(item => `${item.record_id} ${item.title || ''} ${item.department_agency || ''}`.toLowerCase().includes(search.trim().toLowerCase())
        && (!year || (Number(String(item.planning_start_date || '').slice(0, 4)) <= Number(year) && Number(String(item.planning_end_date || '').slice(0, 4)) >= Number(year)))
        && (!office || item.department_agency === office) && (!status || item.status === status)
        && (!approvalStatus || item.approval_status === approvalStatus));
    if (!planId) return h('section', { className: 'management-card management-table-card' },
        h('div', { className: 'management-card__heading' }, h('div', null,
            h('h2', null, mode === 'objectives' ? 'Choose a plan for Objectives Review' : 'Strategic Plans for Review'),
            h('p', null, mode === 'objectives' ? 'Open a plan to see its objective list, owners and progress.' : 'Open a plan to review its summary, foundations and comments.')),
            h('label', { className: 'management-approvals__search' }, h('span', null, 'Search plans'), h('input', { type: 'search', value: search, onChange: event => { setSearch(event.target.value); setPage(1); }, placeholder: 'Plan title, ID or agency' }))),
        h('div', { className: 'management-scope-filters', 'aria-label': 'Plan review filters' },
            h('label', null, h('span', null, 'Planning period'), h('select', { value: year, onChange: event => { setYear(event.target.value); setPage(1); } }, h('option', { value: '' }, 'All periods'), planningYears(plans).map(item => h('option', { key: item, value: String(item) }, item)))),
            h('label', null, h('span', null, 'Office / Unit'), h('select', { value: office, onChange: event => { setOffice(event.target.value); setPage(1); } }, h('option', { value: '' }, 'All offices'), [...new Set(plans.map(item => item.department_agency).filter(Boolean))].sort().map(item => h('option', { key: item, value: item }, item)))),
            h('label', null, h('span', null, 'Plan status'), h('select', { value: status, onChange: event => { setStatus(event.target.value); setPage(1); } },
                h('option', { value: '' }, 'All statuses'),
                [...new Set(plans.map(item => item.status).filter(Boolean))].sort().map(item => h('option', { key: item, value: item }, item.replaceAll('_', ' '))))),
            h('label', null, h('span', null, 'Approval status'), h('select', { value: approvalStatus, onChange: event => { setApprovalStatus(event.target.value); setPage(1); } },
                h('option', { value: '' }, 'All approvals'),
                [['not_submitted', 'Not submitted'], ['under_approval', 'Awaiting approval'], ['approved', 'Approved'], ['rejected', 'Returned / rejected']].map(([value, label]) => h('option', { key: value, value }, label))))),
        h('div', { className: 'management-table-scroll' }, h('table', null,
            h('thead', null, h('tr', null, ['Plan ID', 'Strategic Plan', 'Department / Agency', 'Period', 'Status', 'Action'].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, visiblePlans.length ? pageRows(visiblePlans, page).map(item => h('tr', { key: item.record_id },
                h('td', null, item.record_id), h('td', null, item.title), h('td', null, item.department_agency || '—'),
                h('td', null, `${dateLabel(item.planning_start_date)} – ${dateLabel(item.planning_end_date)}`), h('td', null, item.status || '—'),
                h('td', null, h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => onOpenPlan(item.record_id) }, mode === 'objectives' ? 'View objectives' : 'View summary'))))
                : h('tr', null, h('td', { colSpan: 6 }, plans.length ? 'No plans match these filters.' : 'No plans are available for review.'))))),
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
            h('div', { className: 'office-plan-toolbar' }, h('h2', { id: 'management-plan-summary-title' }, 'Plan Summary'), h('span', { className: 'management-plan-review__status' }, plan.status || '—')),
            h('dl', { className: 'office-summary-grid' },
                field('Plan ID', plan.record_id), field('Plan Title', plan.title),
                field('Plan period', plan.planning_start_date && plan.planning_end_date ? `${dateLabel(plan.planning_start_date)} – ${dateLabel(plan.planning_end_date)}` : null),
                field('Department / Agency', plan.department_agency), field('Last Updated', dateLabel(plan.updated_at))),
            author ? h('p', { className: 'office-muted' }, `Created by ${author}`) : null,
            mode === 'plans' ? h('dl', { className: 'office-foundations' },
                field('Mission', plan.mission_foundation?.content), field('Vision', plan.vision_foundation?.content),
                field('Core Values', plan.core_values?.length ? h('ul', null, plan.core_values.map((value, index) => h('li', { key: value.foundation_id || index }, value.content))) : null)) : null),
        h('section', { className: 'office-detail-objectives', 'aria-labelledby': 'management-objectives-title' },
            h('h2', { id: 'management-objectives-title' }, 'Strategic Objectives'),
            h('div', { className: 'office-table-scroll' }, h('table', null,
                h('thead', null, h('tr', null, ['No.', 'Objective', 'Expected outcome', 'Indicator', 'Target', 'Responsible Office / Agency', 'Progress'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                h('tbody', null, objectiveRows))),
            h(ManagementPagination, { page: objectivePage, total: objectives.length, onChange: setObjectivePage, label: 'objectives' })),
        canComment ? h('section', { className: 'management-plan-comments', 'aria-labelledby': 'management-plan-comments-title' },
            h('h2', { id: 'management-plan-comments-title' }, 'Plan comments'),
            commentError ? h('p', { className: 'management-dashboard__errors', role: 'alert' }, commentError) : null,
            comments.length ? h('ul', null, comments.map(comment => h('li', { key: comment.plan_comment_id },
                h('p', null, comment.content), h('small', null, `${comment.submitter_name || 'Reviewer'} · ${dateLabel(comment.submitted_at)}`)))) : h('p', { className: 'management-empty' }, 'No comments yet.'),
            h('form', { onSubmit: submitComment },
                h('label', null, h('span', null, 'Add a comment'), h('textarea', { value: commentText, onChange: event => setCommentText(event.target.value), rows: 3, maxLength: 10000, required: true })),
                h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'submit', disabled: savingComment || !commentText.trim() }, savingComment ? 'Saving…' : 'Post comment'))) : null) : null;
    return h('div', { className: 'management-plan-review' },
        h('button', { className: 'ui-button ui-button--secondary ui-button--sm management-plan-review__back', type: 'button', onClick: onBack }, h('i', { className: 'bi bi-chevron-left', 'aria-hidden': true }), ' Back to plans'),
        loading ? h('p', { role: 'status' }, 'Loading plan review…') : null,
        error ? h('div', { className: 'management-dashboard__errors', role: 'alert' }, error) : null,
        detail);
}
