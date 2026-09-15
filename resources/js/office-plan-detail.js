import { can, getAccessSession } from './access/access-session.js';
import { OfficeComments } from './office-comments.js';
import { getStrategicPlan } from './api/strategic-plans-api.js';
import { listStrategicObjectives } from './api/strategic-objectives-api.js';
import { objectivesAssignedToOffice } from './objective-assignment-storage.js';
const h = React.createElement;
const { useEffect, useState } = React;
const dateLabel = value => {
    if (!value) return 'Not provided';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not provided' : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function OfficePlanDetail({ planId }) {
    const [plan, setPlan] = useState(null);
    const [objectives, setObjectives] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [objectiveError, setObjectiveError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [page, setPage] = useState(1);
    const [notes, setNotes] = useState('');
    const [assignmentVersion, setAssignmentVersion] = useState(0);
    const pageSize = 5;
    useEffect(() => { const refresh = event => { if (!event.key || event.key === 'spdms.frontend-objective-assignments') setAssignmentVersion(value => value + 1); }; window.addEventListener('storage', refresh); window.addEventListener('spdms:objective-assignments-changed', refresh); return () => { window.removeEventListener('storage', refresh); window.removeEventListener('spdms:objective-assignments-changed', refresh); }; }, []);
    useEffect(() => {
        let active = true;
        setLoading(true); setError(''); setObjectiveError(''); setPlan(null); setObjectives([]); setPage(1);
        async function load() {
            try {
                const payload = await getStrategicPlan(planId);
                if (!active) return;
                setPlan(payload.data);
                try {
                    const result = await listStrategicObjectives(planId);
                    if (active) setObjectives(objectivesAssignedToOffice(result.data || [], getAccessSession()?.office));
                } catch (err) { if (active) setObjectiveError(err.message); }
            } catch (err) { if (active) setError(err.message); }
            finally { if (active) setLoading(false); }
        }
        load();
        return () => { active = false; };
    }, [planId, attempt, assignmentVersion]);
    const field = (label, value) => h('div', { className: 'office-summary-field', key: label }, h('dt', null, label), h('dd', null, value || 'Not provided'));
    const pageCount = Math.max(1, Math.ceil(objectives.length / pageSize));
    const author = plan?.creator?.name || [plan?.creator?.first_name, plan?.creator?.last_name].filter(Boolean).join(' ');
    const isDraft = plan?.status === 'draft';
    return h('main', { className: 'office-content office-detail', 'aria-busy': loading },
        h('header', { className: 'office-detail-heading' },
            h('a', { href: '/office', className: 'office-back', 'aria-label': 'Back to initial plans' }, h('i', { className: 'bi bi-chevron-left', 'aria-hidden': true })),
            h('h1', null, plan ? `${plan.record_id} ${plan.title}` : 'Plan details')),
        loading && h('p', { role: 'status' }, 'Loading plan details...'),
        error && h('div', { className: 'office-panel', role: 'alert' }, h('p', null, error), h('button', { onClick: () => setAttempt(attempt + 1) }, 'Retry')),
        plan && !loading && h('article', { className: 'office-panel office-detail-panel' },
            h('section', { 'aria-labelledby': 'plan-summary-title' },
                h('div', { className: 'office-plan-toolbar' }, h('h2', { id: 'plan-summary-title' }, 'Plan Summary'), isDraft && can('strategic_objectives.create') && h('a', { className: 'office-action-link', href: '/office?plan=' + encodeURIComponent(planId) + '&view=inputs' }, 'Submit Input')),
                h('dl', { className: 'office-summary-grid' },
                    field('Plan ID', plan.record_id), field('Plan Title', plan.title),
                    field('Plan period', plan.planning_start_date && plan.planning_end_date ? `${dateLabel(plan.planning_start_date)} – ${dateLabel(plan.planning_end_date)}` : null),
                    field('Department/Agency', plan.department_agency), field('Last Updated', dateLabel(plan.updated_at))),
                author && h('p', { className: 'office-muted' }, `Created by ${author}`),
                h('dl', { className: 'office-foundations' },
                    field('Mission', plan.mission_foundation?.content),
                    field('Vision', plan.vision_foundation?.content),
                    field('Core Values', plan.core_values?.length ? h('ul', null, plan.core_values.map((value, index) => h('li', { key: value.foundation_id || index }, value.content))) : null))),
            h('section', { className: 'office-detail-objectives', 'aria-labelledby': 'objectives-title' },
                h('h2', { id: 'objectives-title' }, 'Strategic Objectives'),
                objectiveError ? h('p', { role: 'alert' }, objectiveError, ' ', h('button', { onClick: () => setAttempt(attempt + 1) }, 'Retry')) : h(React.Fragment, null,
                    h('div', { className: 'office-table-scroll' }, h('table', null,
                        h('thead', null, h('tr', null, ['No.', 'Objectives', 'Expected outcome', 'Indicator', 'Target', 'Responsible Office/Agency'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                        h('tbody', null, objectives.length ? objectives.slice((page - 1) * pageSize, page * pageSize).map((objective, index) => h('tr', { key: objective.objective_id },
                            h('td', null, (page - 1) * pageSize + index + 1), h('td', null, objective.objective_title || objective.objective_description || '—'),
                            ...['expected_outcome', 'indicator', 'target', 'responsible_office_agency'].map(key => h('td', { key }, objective[key] || '—'))))
                            : h('tr', null, h('td', { colSpan: 6 }, 'No strategic objectives have been added to this plan.'))))),
                    h('footer', { className: 'office-pagination' }, h('span', null, `${objectives.length} objectives`),
                        h('button', { 'aria-label': 'Previous objectives page', disabled: page <= 1, onClick: () => setPage(page - 1) }, '‹'),
                        h('span', { 'aria-live': 'polite' }, `${page} / ${pageCount}`),
                        h('button', { 'aria-label': 'Next objectives page', disabled: page >= pageCount, onClick: () => setPage(page + 1) }, '›')))),
            h(OfficeComments, { plan })));
}

