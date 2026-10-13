import { can } from '../../access/access-session.js';
import {
    listObjectiveInputs,
    submitPlanInput,
} from '../../api/implementation-inputs-api.js';
import { listPlanAlignments } from '../../api/strategic-alignments-api.js';

const h = React.createElement;

export function ObjectiveFeedback({ plan, objective }) {
    const [expanded, setExpanded] = React.useState(false);
    const [content, setContent] = React.useState('');
    const [rows, setRows] = React.useState([]);
    const [busy, setBusy] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [refresh, setRefresh] = React.useState(0);
    const [feedbackKind, setFeedbackKind] = React.useState('objective_feedback');
    const [mappings, setMappings] = React.useState([]);
    const [selectedMapping, setSelectedMapping] = React.useState('');
    const [mappingLoading, setMappingLoading] = React.useState(false);
    const [mappingError, setMappingError] = React.useState('');

    React.useEffect(() => {
        if (!expanded || !can('implementation_inputs.view')) return;
        let active = true;
        setLoading(true);
        setError('');

        (async () => {
            try {
                const all = [];
                let page = 1;
                let lastPage = 1;
                do {
                    const result = await listObjectiveInputs(
                        objective.objective_id,
                        { page }
                    );
                    if (!active) return;
                    all.push(...(result.data || []));
                    lastPage = result.meta?.last_page || 1;
                    page++;
                } while (page <= lastPage);

                setRows(all.sort((a, b) => b.input_id - a.input_id));
            } catch (err) {
                if (active) setError(err.message);
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => { active = false; };
    }, [expanded, objective.objective_id, refresh]);
    React.useEffect(() => {
    if (!expanded || feedbackKind !== 'mapping_feedback') return;

    let active = true;
    setMappingLoading(true);
    setMappingError('');
    setMappings([]);
    setSelectedMapping('');

    listPlanAlignments(plan.record_id)
        .then(result => {
            if (!active) return;
            setMappings((result.data || []).filter(mapping =>
                Number(mapping.objective_id) === Number(objective.objective_id)
                && mapping.status === 'active'
            ));
        })
        .catch(err => {
            if (active) setMappingError(err.message);
        })
        .finally(() => {
            if (active) setMappingLoading(false);
        });

    return () => { active = false; };
}, [expanded, feedbackKind, plan.record_id, objective.objective_id]);
    const allowed = can('implementation_inputs.create')
        && ['draft', 'finished'].includes(plan.status)
        && ['draft', 'published'].includes(objective.status);

    async function submit(event) {
        event.preventDefault();
        if (!allowed || busy || !content.trim()) return;
        const mapping = feedbackKind === 'mapping_feedback'
    ? mappings.find(item => item.id === selectedMapping)
    : null;

if (feedbackKind === 'mapping_feedback' && !mapping) {
    setError('Select an active mapping before submitting feedback.');
    return;
}
        setBusy(true);
        setError('');
        setMessage('');

        try {
            await submitPlanInput(plan.record_id, {
                objective_id: objective.objective_id,
                input_type: plan.status === 'draft'
                    && objective.status === 'draft'
                    ? 'change_request'
                    : 'issue',
                content: content.trim(),
                feedback_category: feedbackKind,
...(mapping ? {
    mapping_type: mapping.type,
    mapping_reference_id: mapping.reference_id,
} : {}),
            });
            setContent('');
            setMessage('Feedback submitted for review. Track its outcome in My Inputs.');
            setRefresh(value => value + 1);
        } catch (err) {
            setError([
                err.message,
                ...Object.values(err.errors || {}).flat(),
            ].join(' '));
        } finally {
            setBusy(false);
        }
    }

    return h('details', {
        onToggle: event => setExpanded(event.currentTarget.open),
    },
        h('summary', null, 'Feedback & History'),
        h('p', null, `Feedback on: ${objective.objective_title}`),
        h('p', null, 'Your suggestion will be reviewed before any objective is changed.'),
        error && h('p', { role: 'alert' },
            error,
            ' ',
            h('button', {
                type: 'button',
                onClick: () => setRefresh(value => value + 1),
            }, 'Retry history')),
        message && h('p', { role: 'status' }, message),
        allowed && h('form', { onSubmit: submit },
            h('label', {
                htmlFor: `objective-feedback-${objective.objective_id}`,
            }, h('label', {
    htmlFor: `feedback-kind-${objective.objective_id}`,
}, 'Feedback about'),

h('select', {
    id: `feedback-kind-${objective.objective_id}`,
    className: 'ui-select',
    value: feedbackKind,
    disabled: busy,
    onChange: event => {
        setFeedbackKind(event.target.value);
        setSelectedMapping('');
        setError('');
        setMessage('');
    },
},
    h('option', { value: 'objective_feedback' },
    `Objective: ${objective.objective_title || `#${objective.objective_id}`}`),
    h('option', { value: 'mapping_feedback' }, 'A mapping for this objective')
),

feedbackKind === 'mapping_feedback' && h(React.Fragment, null,
    h('label', {
        htmlFor: `feedback-mapping-${objective.objective_id}`,
    }, 'Mapping'),

    h('select', {
        id: `feedback-mapping-${objective.objective_id}`,
        className: 'ui-select',
        value: selectedMapping,
        required: true,
        disabled: busy || mappingLoading,
        onChange: event => setSelectedMapping(event.target.value),
    },
        h('option', { value: '' },
            mappingLoading ? 'Loading mappings…' : 'Select a mapping'),
        mappings.map(mapping => h('option', {
            key: mapping.id,
            value: mapping.id,
        }, `${mapping.type === 'pdp-chapter' ? 'PDP' : 'Presidential Agenda'}: ${mapping.reference_title}`))
    ),

    mappingError && h('p', { role: 'alert' }, mappingError),
    !mappingLoading && !mappingError && !mappings.length
        && h('p', null, 'This objective has no active mappings to comment on.')
),'Your suggestion'),
            h('textarea', {
                id: `objective-feedback-${objective.objective_id}`,
                className: 'ui-textarea',
                value: content,
                onChange: event => setContent(event.target.value),
                rows: 3,
                maxLength: 10000,
                required: true,
                disabled: busy,
            }),
            h('button', {
                type: 'submit',
                className: 'ui-button ui-button--primary ui-button--sm',
                disabled: busy || !content.trim(),
            }, busy ? 'Submitting…' : 'Submit for Review')
        ),
        !allowed && h('p', null, 'This objective is not open for new feedback.'),
        loading && h('p', { role: 'status' }, 'Loading history…'),
        can('implementation_inputs.view') && h('details', null,
            h('summary', null, 'Previous submissions'),
            !loading && !error && !rows.length
                && h('p', null, 'No inputs submitted for this objective yet.'),
            rows.map(item => h('article', { key: item.input_id },
                h('strong', null, item.review_status),
                item.feedback_category === 'mapping_feedback'
    && h('p', null,
        `Mapping feedback: ${item.mapping_reference_title || 'Reference unavailable'}`),
                h('p', { style: { whiteSpace: 'pre-wrap' } }, item.content),
                item.reviewer_name
                    && h('small', null, `Reviewed by ${item.reviewer_name}`),
                item.review_note
                    && h('p', null, `Reviewer remarks: ${item.review_note}`)
            ))
        )
    );
}