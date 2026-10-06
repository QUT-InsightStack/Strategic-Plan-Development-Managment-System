import { getStrategicPlan } from '../../api/strategic-plans-api.js';
import { listStrategicObjectives } from '../../api/strategic-objectives-api.js';
import { apiRequest } from '../../api/api-client.js';

const h = React.createElement;
const { useEffect, useState } = React;

function dateLabel(value) {
    if (!value) return 'Not provided';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function field(label, value) {
    return h('div', { className: 'office-summary-field', key: label }, h('dt', null, label), h('dd', null, value || 'Not provided'));
}

export function ManagementPlanReview({ plans, planId, onOpenPlan, onBack }) {
    const [plan, setPlan] = useState(null);
    const [objectives, setObjectives] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!planId) { setPlan(null); setObjectives([]); setError(''); return undefined; }
        let active = true;
        setLoading(true); setError('');
        Promise.all([getStrategicPlan(planId), listStrategicObjectives(planId)])
            .then(([planPayload, objectivePayload]) => {
                if (!active) return;
                setPlan(planPayload.data);
                setObjectives(objectivePayload.data || []);
            })
            .catch(reason => { if (active) setError(reason.message || 'Unable to load plan details.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [planId]);

    if (!planId) return h('section', { className: 'management-card management-table-card' },
        h('div', { className: 'management-card__heading' }, h('div', null, h('h2', null, 'Strategic Plans for Review'), h('p', null, 'Review plan foundations and objectives using the authorized plans available to your role.'))),
        h('div', { className: 'management-table-scroll' }, h('table', null,
            h('thead', null, h('tr', null, ['Plan ID', 'Strategic Plan', 'Department / Agency', 'Period', 'Status', 'Action'].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, plans.length ? plans.map(item => h('tr', { key: item.record_id },
                h('td', null, item.record_id), h('td', null, item.title), h('td', null, item.department_agency || '—'),
                h('td', null, `${dateLabel(item.planning_start_date)} – ${dateLabel(item.planning_end_date)}`), h('td', null, item.status || '—'),
                h('td', null, h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => onOpenPlan(item.record_id) }, 'View plan'))))
                : h('tr', null, h('td', { colSpan: 6 }, 'No plans are available for review.'))))),
        h('p', { className: 'management-plan-review__count' }, `${plans.length} plan(s)`));

    const author = plan?.creator?.name || [plan?.creator?.first_name, plan?.creator?.last_name].filter(Boolean).join(' ');
    const objectiveRows = objectives.length ? objectives.map((objective, index) => {
        const progress = Math.max(0, Math.min(100, Number(objective.progress_percentage) || 0));
        return h('tr', { key: objective.objective_id }, h('td', null, index + 1), h('td', null, objective.objective_title || objective.objective_description || '—'),
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
            h('dl', { className: 'office-foundations' },
                field('Mission', plan.mission_foundation?.content), field('Vision', plan.vision_foundation?.content),
                field('Core Values', plan.core_values?.length ? h('ul', null, plan.core_values.map((value, index) => h('li', { key: value.foundation_id || index }, value.content))) : null))),
        h('section', { className: 'office-detail-objectives', 'aria-labelledby': 'management-objectives-title' },
            h('h2', { id: 'management-objectives-title' }, 'Strategic Objectives'),
            h('div', { className: 'office-table-scroll' }, h('table', null,
                h('thead', null, h('tr', null, ['No.', 'Objective', 'Expected outcome', 'Indicator', 'Target', 'Responsible Office / Agency', 'Progress'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                h('tbody', null, objectiveRows))))) : null;
    return h('div', { className: 'management-plan-review' },
        h('button', { className: 'ui-button ui-button--secondary ui-button--sm management-plan-review__back', type: 'button', onClick: onBack }, h('i', { className: 'bi bi-chevron-left', 'aria-hidden': true }), ' Back to plans'),
        loading ? h('p', { role: 'status' }, 'Loading plan review…') : null,
        error ? h('div', { className: 'management-dashboard__errors', role: 'alert' }, error) : null,
        detail);
}

export function ManagementReferenceDocuments({ plans }) {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        Promise.all(plans.map(async plan => {
            const result = await apiRequest(`/api/strategic-plans/${encodeURIComponent(plan.record_id)}/documents?per_page=100`);
            return (result.data || []).map(document => ({ ...document, plan }));
        }))
            .then(groups => { if (active) setDocuments(groups.flat()); })
            .catch(reason => { if (active) setError(reason.message || 'Unable to load reference documents.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [plans]);

    return h('section', { className: 'management-card management-table-card' },
        h('div', { className: 'management-card__heading' }, h('div', null, h('h2', null, 'Reference Documents'), h('p', null, 'Supporting files uploaded to authorized strategic plans.'))),
        error ? h('p', { className: 'management-dashboard__errors', role: 'alert' }, error) : null,
        h('div', { className: 'management-table-scroll' }, h('table', null,
            h('thead', null, h('tr', null, ['Document', 'Strategic Plan', 'Category', 'Uploaded', 'Action'].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 5 }, 'Loading reference documents…')) : documents.length ? documents.map(document => h('tr', { key: `${document.plan.record_id}-${document.document_id}` },
                h('td', null, document.original_filename || 'Reference document'),
                h('td', null, document.plan.title), h('td', null, document.content_category || document.reference_level || '—'), h('td', null, dateLabel(document.created_at)),
                h('td', null, h('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: `/api/strategic-documents/${encodeURIComponent(document.document_id)}/download`, target: '_blank', rel: 'noreferrer' }, 'Open'))))
                : h('tr', null, h('td', { colSpan: 5 }, 'No reference documents are attached to the available plans.'))))));
}
