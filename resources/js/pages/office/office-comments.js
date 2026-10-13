import { can } from '../../access/access-session.js';
import { listStrategicPlanComments } from '../../api/strategic-plans-api.js';
import { listPlanInputs, submitPlanInput } from '../../api/implementation-inputs-api.js';

const h = React.createElement;
const emptyProposal = { objective_title: '', objective_description: '', expected_outcome: '', indicator: '', target: '' };
const proposalFields = [
    ['objective_title', 'Proposed objective', true],
    ['objective_description', 'Description', false],
    ['expected_outcome', 'Expected outcome', false],
    ['indicator', 'Indicator', false],
    ['target', 'Target', false],
];

export function OfficeComments({ plan, mode = 'comments' }) {
    const [comment, setComment] = React.useState('');
    const [proposal, setProposal] = React.useState(emptyProposal);
    const [items, setItems] = React.useState([]);
    const [page, setPage] = React.useState(1);
    const [last, setLast] = React.useState(1);
    const [refresh, setRefresh] = React.useState(0);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [submissions, setSubmissions] = React.useState([]);
    const [historyLoading, setHistoryLoading] = React.useState(false);
    const [historyError, setHistoryError] = React.useState('');

    React.useEffect(() => {
        if (mode !== 'comments' || !can('objective_comments.create')) return;
        let active = true;
        listStrategicPlanComments(plan.record_id, { page }).then(result => {
            if (active) { setItems(result.data || []); setLast(result.meta?.last_page || 1); }
        }).catch(err => { if (active) setError(err.message); });
        return () => { active = false; };
    }, [plan.record_id, mode, page, refresh]);

    React.useEffect(() => {
    if (mode !== 'comments' || !can('implementation_inputs.view')) {
        setSubmissions([]);
        return;
    }

    let active = true;
    setHistoryLoading(true);
    setHistoryError('');
    setSubmissions([]);

    async function loadHistory() {
        try {
            const rows = [];
            let currentPage = 1;
            let lastPage = 1;

            do {
                const result = await listPlanInputs(plan.record_id, {
                    page: currentPage,
                });

                if (!active) return;

                rows.push(...(result.data || []));
                lastPage = result.meta?.last_page || 1;
                currentPage++;
            } while (currentPage <= lastPage);

            setSubmissions(
                rows
                    .filter(item => item.objective_id == null)
                    .sort((a, b) => Number(b.input_id) - Number(a.input_id))
            );
        } catch (err) {
            if (active) setHistoryError(err.message);
        } finally {
            if (active) setHistoryLoading(false);
        }
    }

    loadHistory();
    return () => { active = false; };
}, [plan.record_id, mode, refresh]);

    async function submit(event) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError(''); setMessage('');
        try {
            if (mode === 'comments') {
                const content = comment.trim();
                if (!content) return;
                await submitPlanInput(plan.record_id, {content: `Plan feedback:\n${content}`, input_type: plan.status === 'draft' ? 'change_request' : 'issue',});
                setComment('');
                setPage(1);
                setRefresh(value => value + 1);
                setMessage('Planning input submitted for review. Track the decision and reviewer remarks in My Inputs.');
            } else {
                const content = proposalFields.map(([key, label]) => `${label}: ${proposal[key].trim() || '—'}`).join('\n');
                await submitPlanInput(plan.record_id, { content, input_type: 'change_request' });
                setProposal(emptyProposal);
                setRefresh(value => value + 1);
                setMessage('Proposed objective submitted for review.');
            }
        } catch (err) { setError([err.message, ...Object.values(err.errors || {}).flat()].join(' ')); }
        finally { setBusy(false); }
    }

    const isComment = mode === 'comments';
    const allowed = can('implementation_inputs.create')
    && (isComment
        ? ['draft', 'finished'].includes(plan.status)
        : plan.status === 'draft');
    return h('section', { className: 'office-plan-action', 'aria-label': isComment ? 'Submit plan feedback' : 'Propose objective' },
        h('div', { className: 'office-plan-action__heading' },
            h('h2', null, isComment ? 'Submit Planning Input' : 'Proposed Objective'),
            h('span', { className: 'office-muted' }, `${plan.record_id} · ${plan.title}`)),
            isComment && h('p', { className: 'office-muted' },
    'Your feedback will be sent to the assigned planning reviewer. Submitting it does not change the plan. Track the outcome in My Inputs.'),
isComment && h('a', { href: '/consolidate-inputs' }, 'View My Inputs'),
        error && h('p', { role: 'alert', className: 'office-plan-action__message' }, error),
        message && h('p', { role: 'status', className: 'office-plan-action__message' }, message),
        isComment && can('implementation_inputs.view') && h('details', {
    className: 'office-plan-action__history',
},
    h('summary', null, 'Previous submissions'),
    historyLoading && h('p', { role: 'status' }, 'Loading submissions…'),
    historyError && h('p', { role: 'alert' },
        historyError,
        ' ',
        h('button', {
            type: 'button',
            onClick: () => setRefresh(value => value + 1),
        }, 'Retry')),
    !historyLoading && !historyError && (
        submissions.length
            ? h('div', { className: 'office-plan-action__history-list' },
                submissions.map(item => h('article', { key: item.input_id },
                    h('strong', null, item.review_status || 'Pending Review'),
                    h('p', {
                        style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
                    }, item.content),
                    h('small', null,
                        `Submitted by ${item.submitter_name || 'Office user'}`),
                    item.reviewer_name && h('p', null,
                        `Reviewed by ${item.reviewer_name}`),
                    item.review_note && h('p', {
                        style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
                    }, `Reviewer remarks: ${item.review_note}`)
                )))
            : h('p', null, 'No planning inputs submitted for this plan yet.')
    ),
    h('a', { href: '/consolidate-inputs' }, 'View all inputs and statuses')
),
        isComment && items.length > 0 && h('details', { className: 'office-plan-action__history' },
            h('summary', null, `Previous comments — before input tracking (${items.length}${last > 1 ? '+' : ''})`),
            h('div', { className: 'office-plan-action__history-list' }, items.map(item => h('article', { key: item.plan_comment_id },
                h('strong', null, item.submitter_name || 'Office user'), h('p', null, item.content))),
                last > 1 && h('div', { className: 'office-pagination' },
                    h('button', { type: 'button', disabled: page <= 1, onClick: () => setPage(page - 1) }, 'Previous'),
                    h('span', null, `${page} / ${last}`),
                    h('button', { type: 'button', disabled: page >= last, onClick: () => setPage(page + 1) }, 'Next')))),
        allowed ? h('form', { onSubmit: submit, className: `office-plan-action__form ${isComment ? '' : 'office-plan-action__form--proposal'}` },
            isComment ? h('label', { className: 'office-plan-action__field', htmlFor: 'office-plan-comment' }, 'Your suggestion or feedback on this plan',
                h('textarea', { id: 'office-plan-comment', value: comment, onChange: event => setComment(event.target.value),
                    required: true, maxLength: 10000, rows: 3, disabled: busy, placeholder: 'Explain what you suggest changing and why…' }))
                : proposalFields.map(([key, label, required]) => h('label', { className: 'office-plan-action__field', key }, label,
                    h('input', { value: proposal[key], onChange: event => setProposal(current => ({ ...current, [key]: event.target.value })),
                        required, maxLength: 5000, disabled: busy, placeholder: label }))),
            h('button', { type: 'submit', className: 'ui-button ui-button--primary',
                disabled: busy || (isComment ? !comment.trim() : !proposal.objective_title.trim()) },
                busy ? 'Submitting…' : isComment ? 'Submit for Review' : 'Submit Proposed Objective'))
            : h('p', { className: 'office-muted' }, isComment
                ? 'Plan feedback requires input submission permission and a draft or finalized plan.'
                : 'Objective proposals require a draft plan and submission permission.'));
}
