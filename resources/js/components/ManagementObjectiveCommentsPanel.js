import {
    listManagementComments,
    addManagementComment,
    acknowledgeManagementComment,
    closeManagementComment,
} from '../api/management-objective-comments-api.js';
import { can, getAccessSession } from '../access/access-session.js';
import '../../css/management-objective-comments.css';

const h = React.createElement;
const { useEffect, useState } = React;

const labels = {
    not_acknowledged: 'Not Acknowledged',
    acknowledged: 'Acknowledged',
    open: 'Open',
    completed: 'Completed',
    incomplete: 'Incomplete',
};

const dateLabel = value =>
    value ? new Date(value).toLocaleString('en-GB') : '—';

const describeError = error =>
    [error.message, ...Object.values(error.errors || {}).flat()]
        .filter(Boolean)
        .join(' ');

export function ManagementObjectiveCommentsPanel({
    planId = null,
    objectives = [],
}) {
    const session = getAccessSession();
    const canCreate = [
        'Management',
        'Executive',
        'Management / Executive',
        'Division Head',
    ].includes(session?.roleName)
        && can('management_objective_comments.create', session);

    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({});
    const [page, setPage] = useState(1);
    const [completion, setCompletion] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [refresh, setRefresh] = useState(0);
    const [objectiveId, setObjectiveId] = useState('');
    const [content, setContent] = useState('');
    const [closing, setClosing] = useState(null);
    const [outcome, setOutcome] = useState('completed');
    const [remarks, setRemarks] = useState('');

    useEffect(() => {
        setPage(1);
        setObjectiveId('');
        setContent('');
        setClosing(null);
        setNotice('');
    }, [planId]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        setRows([]);

        listManagementComments({
            plan_id: planId,
            completion_status: completion,
            page,
            per_page: 10,
        })
            .then(payload => {
                if (!active) return;
                setRows(payload.data || []);
                setMeta(payload.meta || {});
            })
            .catch(reason => {
                if (active) setError(describeError(reason));
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => { active = false; };
    }, [planId, completion, page, refresh]);

    async function perform(task, message, afterSave = () => {}) {
        if (busy) return;
        setBusy(true);
        setError('');
        setNotice('');

        try {
            await task();
            afterSave();
            setNotice(message);
        } catch (reason) {
            setError(describeError(reason));
        } finally {
            setBusy(false);
            setRefresh(value => value + 1);
        }
    }

    function submit(event) {
        event.preventDefault();

        if (!objectiveId || !content.trim() || !canCreate) return;

        perform(
            () => addManagementComment(objectiveId, content.trim()),
            'Comment added. It is awaiting acknowledgement.',
            () => {
                setContent('');
                setPage(1);
                setCompletion('');
            }
        );
    }

    function acknowledge(row) {
        if (!window.confirm(
            'Acknowledge this comment? This confirms receipt; completion will remain Open.'
        )) return;

        perform(
            () => acknowledgeManagementComment(row.comment_id),
            'Comment acknowledged. Completion remains Open.'
        );
    }

    function submitClosure(event) {
        event.preventDefault();

        if (!closing || !remarks.trim()) return;

        if (!window.confirm(
            `Close this comment as ${labels[outcome]}? This cannot be changed through this screen.`
        )) return;

        perform(
            () => closeManagementComment(
                closing.comment_id,
                outcome,
                remarks.trim()
            ),
            'Comment closed.',
            () => {
                setClosing(null);
                setRemarks('');
            }
        );
    }

    const availableObjectives = objectives.filter(
        objective => !['archived', 'deleted'].includes(objective.status)
    );

    return h(
        'section',
        { className: 'office-panel management-comments', 'aria-labelledby': 'management-comments-title' },

        h('h2', { id: 'management-comments-title' }, 'Management Comments'),
        h(
            'p',
            { className: 'ui-help' },
            'Feedback on existing objectives. Acknowledgement confirms receipt. The Management author determines completion. These comments do not use Accept or Decline.'
        ),

        error && h('p', { className: 'ui-error', role: 'alert' }, error),
        notice && h('p', { role: 'status' }, notice),

        canCreate && planId && h(
            'form',
            { onSubmit: submit },
            h(
                'fieldset',
                { disabled: busy, className: 'office-workflow-fields' },
                h('legend', null, 'Add objective comment'),
                h(
                    'label',
                    { className: 'office-field-group' },
                    'Strategic objective',
                    h(
                        'select',
                        {
                            value: objectiveId,
                            required: true,
                            onChange: event => setObjectiveId(event.target.value),
                        },
                        h('option', { value: '' }, 'Select an objective'),
                        availableObjectives.map(objective =>
                            h(
                                'option',
                                {
                                    key: objective.objective_id,
                                    value: objective.objective_id,
                                },
                                objective.objective_title
                            )
                        )
                    )
                ),
                h(
                    'label',
                    { className: 'office-field-group' },
                    'Comment',
                    h('textarea', {
                        value: content,
                        required: true,
                        maxLength: 10000,
                        rows: 4,
                        onChange: event => setContent(event.target.value),
                    })
                ),
                h(
                    'button',
                    {
                        type: 'submit',
                        className: 'ui-button ui-button--primary ui-button--sm',
                        disabled: busy || !objectiveId || !content.trim(),
                    },
                    busy ? 'Saving…' : 'Add Comment'
                )
            )
        ),

        h(
            'label',
            { className: 'office-field-group' },
            'Completion status',
            h(
                'select',
                {
                    value: completion,
                    disabled: busy,
                    onChange: event => {
                        setCompletion(event.target.value);
                        setPage(1);
                        setClosing(null);
                    },
                },
                h('option', { value: '' }, 'All statuses'),
                ['open', 'completed', 'incomplete'].map(value =>
                    h('option', { key: value, value }, labels[value])
                )
            )
        ),

        loading && h('p', { role: 'status' }, 'Loading Management comments…'),
        !loading && !error && !rows.length &&
            h('p', null, 'No Management comments match these filters.'),

        !loading && rows.map(row =>
            h(
                'article',
               {
    key: row.comment_id,
    className: `management-comments__card is-${row.completion_status}`,
},
                h('h3', null, row.objective?.objective_title || 'Objective'),
                h('p', null, row.strategic_plan?.title || 'Strategic plan'),
                h(
                    'p',
                    { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
                    row.content
                ),
                h('p', null, `${row.author_name} · ${dateLabel(row.created_at)}`),
                h(
    'div',
    { className: 'management-comments__statuses' },
    h(
        'span',
        { className: `management-comments__badge is-${row.acknowledgement_status}` },
        labels[row.acknowledgement_status]
    ),
    h(
        'span',
        { className: `management-comments__badge is-${row.completion_status}` },
        labels[row.completion_status]
    )
),
                row.acknowledged_at && h(
                    'p',
                    null,
                    `Acknowledged by ${row.acknowledger_name} · ${dateLabel(row.acknowledged_at)}`
                ),
                row.closed_at && h(
                    React.Fragment,
                    null,
                    h('p', null, `Closed by ${row.closer_name} · ${dateLabel(row.closed_at)}`),
                    h(
                        'p',
                        { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } },
                        row.closing_remarks
                    )
                ),
                row.can_acknowledge && h(
                    'button',
                    {
                        type: 'button',
                        disabled: busy,
                        className: 'ui-button ui-button--primary ui-button--sm',
                        onClick: () => acknowledge(row),
                    },
                    'Acknowledge'
                ),
                row.can_close && h(
                    'button',
                    {
                        type: 'button',
                        disabled: busy,
                        className: 'ui-button ui-button--secondary ui-button--sm',
                        onClick: () => {
                            setClosing(row);
                            setOutcome('completed');
                            setRemarks('');
                        },
                    },
                    'Close Comment'
                ),
                !row.can_close
                    && canCreate
                    && Number(row.author_id) === Number(session?.userId)
                    && row.completion_status === 'open'
                    && row.acknowledgement_status === 'not_acknowledged'
                    && h('p', { className: 'ui-help' }, 'Awaiting planner acknowledgement before closure.')
            )
        ),

        closing && h(
            'form',
            { onSubmit: submitClosure },
            h(
                'fieldset',
                { disabled: busy, className: 'office-workflow-fields' },
                h('legend', null, `Close comment on ${closing.objective?.objective_title || 'objective'}`),
                h(
                    'label',
                    { className: 'office-field-group' },
                    'Outcome',
                    h(
                        'select',
                        { value: outcome, onChange: event => setOutcome(event.target.value) },
                        h('option', { value: 'completed' }, 'Completed'),
                        h('option', { value: 'incomplete' }, 'Incomplete')
                    )
                ),
                h(
                    'label',
                    { className: 'office-field-group' },
                    'Closing remarks',
                    h('textarea', {
                        value: remarks,
                        required: true,
                        maxLength: 5000,
                        rows: 4,
                        onChange: event => setRemarks(event.target.value),
                    })
                ),
                h(
                    'button',
                    {
                        type: 'submit',
                        disabled: busy || !remarks.trim(),
                        className: 'ui-button ui-button--primary ui-button--sm',
                    },
                    busy ? 'Saving…' : 'Confirm Closure'
                ),
                h(
                    'button',
                    {
                        type: 'button',
                        disabled: busy,
                        className: 'ui-button ui-button--secondary ui-button--sm',
                        onClick: () => setClosing(null),
                    },
                    'Cancel'
                )
            )
        ),

        h(
            'footer',
            { className: 'office-pagination' },
            h('span', null, `${loading ? '…' : meta.total || 0} comments`),
            h(
                'button',
                {
                    type: 'button',
                    disabled: loading || busy || page <= 1,
                    onClick: () => { setPage(page - 1); setClosing(null); },
                },
                'Previous'
            ),
            h('span', null, `${page} / ${meta.last_page || 1}`),
            h(
                'button',
                {
                    type: 'button',
                    disabled: loading || busy || page >= (meta.last_page || 1),
                    onClick: () => { setPage(page + 1); setClosing(null); },
                },
                'Next'
            ),
            h(
                'button',
                {
                    type: 'button',
                    disabled: loading || busy,
                    onClick: () => setRefresh(value => value + 1),
                },
                'Refresh'
            )
        )
    );
}