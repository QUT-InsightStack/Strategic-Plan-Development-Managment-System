import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { listStrategicObjectives } from '../../api/strategic-objectives-api.js';
import { submitPlanInput } from '../../api/implementation-inputs-api.js';
import { ObjectiveProgressPanel } from '../../strategic-objectives/ObjectiveProgressPanel.js';
import { getAccessSession } from '../../access/access-session.js';
import { listLocalMappings } from '../../mappings/mapping-storage.js';
import { objectivesAssignedToOffice } from '../../objective-assignment-storage.js';

const h = React.createElement;

export function OfficeWorkflow({ view }) {
    return view === 'progress' ? h(ObjectiveProgressPanel) : h(OfficeDraftWorkflow, { view });
}

function OfficeDraftWorkflow({ view }) {
    const [plans, setPlans] = React.useState([]);
    const [planId, setPlanId] = React.useState('');
    const [objectives, setObjectives] = React.useState([]);
    const [relations, setRelations] = React.useState([]);
    const [data, setData] = React.useState({});
    const [busy, setBusy] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [assignmentVersion, setAssignmentVersion] = React.useState(0);

    React.useEffect(() => {
        const refresh = event => {
            if (!event.key || event.key === 'spdms.frontend-objective-assignments') setAssignmentVersion(value => value + 1);
        };
        window.addEventListener('storage', refresh);
        window.addEventListener('spdms:objective-assignments-changed', refresh);
        return () => {
            window.removeEventListener('storage', refresh);
            window.removeEventListener('spdms:objective-assignments-changed', refresh);
        };
    }, []);

    React.useEffect(() => {
        let active = true;
        (async () => {
            try {
                let page = 1;
                let last = 1;
                const all = [];
                do {
                    const result = await listStrategicPlans({ page, per_page: 100 });
                    all.push(...(result.data || []));
                    last = result.meta?.last_page || 1;
                    page++;
                } while (page <= last);
                if (active) {
                    setPlans(all);
                    if (['mapping', 'alignment'].includes(view)) {
                        setRelations(all.flatMap(plan => listLocalMappings(plan.record_id, getAccessSession()?.office || '')));
                    }
                }
            } catch (error) {
                if (active) setMessage(error.message);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [view]);

    React.useEffect(() => {
        let active = true;
        setObjectives([]);
        setData({});
        if (planId && ['edit', 'agency-input'].includes(view)) {
            listStrategicObjectives(planId).then(result => {
                if (!active) return;
                setObjectives(objectivesAssignedToOffice(result.data || [], getAccessSession()?.office)
                    .filter(objective => !['archived', 'deleted'].includes(objective.status)
                        && (view !== 'edit' || objective.status === 'draft')));
            }).catch(error => { if (active) setMessage(error.message); });
        }
        return () => { active = false; };
    }, [planId, view, assignmentVersion]);

    const field = (name, label, type = 'text', options = null) => h('label', { className: 'office-field-group', key: name }, label,
        options ? h('select', { className: 'office-input', required: true, value: data[name] || '', onChange: e => setData({ ...data, [name]: e.target.value }) },
            h('option', { value: '' }, 'Select…'), options.map(option => h('option', { key: option.value, value: option.value }, option.label)))
            : h(type === 'textarea' ? 'textarea' : 'input', {
                className: 'office-input', type, required: true, min: type === 'number' ? 0 : undefined,
                max: type === 'number' ? 100 : undefined, maxLength: 5000, value: data[name] ?? '',
                onChange: e => setData({ ...data, [name]: e.target.value }),
            }));

    async function submit(event) {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setMessage('');
        try {
            const objectiveId = data.objective_id ? Number(data.objective_id) : null;
            let content;
            let inputType;
            if (view === 'agency-input') {
                content = data.content;
                inputType = data.input_type || 'progress_update';
            } else {
                const labels = {
                    objective_title: 'Proposed objective', objective_description: 'Description',
                    expected_outcome: 'Expected outcome', indicator: 'Indicator', target: 'Target',
                };
                content = Object.entries(labels).map(([key, label]) => `${label}: ${data[key] || '—'}`).join('\n');
                inputType = 'change_request';
            }
            await submitPlanInput(Number(planId), { content, input_type: inputType, objective_id: objectiveId });
            setData({});
            setMessage(view === 'agency-input'
                ? 'Agency input submitted for Planning Officer review.'
                : 'Objective proposal submitted for Planning Officer review.');
        } catch (error) {
            setMessage([error.message, ...Object.values(error.errors || {}).flat()].join(' '));
        } finally {
            setBusy(false);
        }
    }

    const choices = plans.filter(plan => view === 'agency-input'
        ? ['draft', 'finished'].includes(plan.status)
        : plan.status === 'draft');
    const objectiveSelector = h('label', { className: 'office-field-group' },
        view === 'edit' ? 'Assigned draft objective' : 'Assigned objective',
        h('select', {
            className: 'office-input', required: true, value: data.objective_id || '',
            onChange: event => {
                const objective = objectives.find(item => String(item.objective_id) === event.target.value);
                setData(objective ? { objective_id: objective.objective_id } : {});
            },
        }, h('option', { value: '' }, 'Select an assigned objective'),
        objectives.map(objective => h('option', { key: objective.objective_id, value: objective.objective_id }, objective.objective_title || `Objective ${objective.objective_id}`))));

    return h('section', { className: 'office-panel' },
        ['mapping', 'alignment'].includes(view) && h('aside', { className: 'data-source-notice' },
            h('p', null, 'Legacy mapping preview. These mappings are stored in this browser. This old form has no mapping save integration.'),
            h('a', { href: view === 'alignment' ? '/mappings?mode=view' : '/mappings' }, 'Open the current mapping page')),
        h('div', { role: 'status', 'aria-live': 'polite' }, loading ? 'Loading…' : message),
        !loading && view !== 'alignment' && h('form', { onSubmit: submit },
            h('fieldset', { disabled: busy || view === 'mapping', className: 'office-workflow-fields' },
                h('label', { className: 'office-field-group' }, 'Strategic plan',
                    h('select', { className: 'office-input', required: true, value: planId, onChange: event => setPlanId(event.target.value) },
                        h('option', { value: '' }, 'Select a plan in your scope'),
                        choices.map(plan => h('option', { key: plan.record_id, value: plan.record_id }, plan.title))),
                ['edit', 'agency-input'].includes(view) && objectiveSelector,
                view === 'agency-input' && data.objective_id && h(React.Fragment, null,
                    h('label', { className: 'office-field-group' }, 'Input type',
                        h('select', { className: 'office-input', value: data.input_type || 'progress_update', onChange: event => setData({ ...data, input_type: event.target.value }) },
                            h('option', { value: 'progress_update' }, 'Progress update'), h('option', { value: 'issue' }, 'Issue'))),
                    field('content', 'Agency input', 'textarea')),
                view === 'edit' && data.objective_id && h(React.Fragment, null,
                    field('objective_title', 'Objective title'), field('objective_description', 'Description', 'textarea'),
                    field('expected_outcome', 'Expected outcome', 'textarea'), field('indicator', 'Indicator'), field('target', 'Target')),
                view === 'proposal' && h(React.Fragment, null,
                    field('objective_title', 'Proposed objective'), field('objective_description', 'Description', 'textarea'),
                    field('expected_outcome', 'Expected outcome', 'textarea'), field('indicator', 'Indicator'), field('target', 'Target')),
                view === 'mapping' && field('parent_id', 'Parent plan / alignment', 'text', plans
                    .filter(plan => String(plan.record_id) !== planId).map(plan => ({ value: plan.record_id, label: plan.title }))),
                h('button', { type: 'submit', disabled: !planId
                    || (['edit', 'agency-input'].includes(view) && !data.objective_id)
                    || (view === 'agency-input' && !String(data.content || '').trim()) }, busy ? 'Submitting…'
                    : view === 'agency-input' ? 'Submit Agency Input'
                    : view === 'edit' ? 'Submit Objective Changes'
                    : view === 'mapping' ? 'Save mapping' : 'Submit Objective Proposal'))),
        ['mapping', 'alignment'].includes(view) && h('div', { className: 'office-table-scroll' },
            h('h2', null, 'Plan alignment'), h('table', null,
                h('thead', null, h('tr', null, h('th', null, 'Plan'), h('th', null, 'Parent plan'))),
                h('tbody', null, relations.length ? relations.map(relation => h('tr', { key: relation.relation_id },
                    h('td', null, relation.record?.title || relation.record_id), h('td', null, relation.parent?.title || relation.parent_id)))
                    : h('tr', null, h('td', { colSpan: 2 }, 'No alignments available.')))))));
}
