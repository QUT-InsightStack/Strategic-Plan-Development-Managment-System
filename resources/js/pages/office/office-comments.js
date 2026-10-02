import { can } from '../../access/access-session.js';
import { listStrategicPlanComments, addStrategicPlanComment } from '../../api/strategic-plans-api.js';
import { submitPlanInput } from '../../api/implementation-inputs-api.js';

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

    React.useEffect(() => {
        if (mode !== 'comments' || !can('objective_comments.create')) return;
        let active = true;
        listStrategicPlanComments(plan.record_id, { page }).then(result => {
            if (active) { setItems(result.data || []); setLast(result.meta?.last_page || 1); }
        }).catch(err => { if (active) setError(err.message); });
        return () => { active = false; };
    }, [plan.record_id, mode, page, refresh]);

    async function submit(event) {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError(''); setMessage('');
        try {
            if (mode === 'comments') {
                const content = comment.trim();
                if (!content) return;
                await addStrategicPlanComment(plan.record_id, content);
                setComment('');
                setPage(1);
                setRefresh(value => value + 1);
                setMessage('Plan comment submitted.');
            } else {
                const content = proposalFields.map(([key, label]) => `${label}: ${proposal[key].trim() || '—'}`).join('\n');
                await submitPlanInput(plan.record_id, { content, input_type: 'change_request' });
                setProposal(emptyProposal);
                setMessage('Proposed objective submitted for review.');
            }
        } catch (err) { setError([err.message, ...Object.values(err.errors || {}).flat()].join(' ')); }
        finally { setBusy(false); }
    }

    const isComment = mode === 'comments';
    const allowed = isComment ? can('objective_comments.create') : can('implementation_inputs.create') && plan.status === 'draft';
    return h('section', { className: 'office-plan-action', 'aria-label': isComment ? 'Comment on plan' : 'Propose objective' },
        h('div', { className: 'office-plan-action__heading' },
            h('h2', null, isComment ? 'Comment on this plan' : 'Proposed Objective'),
            h('span', { className: 'office-muted' }, `${plan.record_id} · ${plan.title}`)),
        error && h('p', { role: 'alert', className: 'office-plan-action__message' }, error),
        message && h('p', { role: 'status', className: 'office-plan-action__message' }, message),
        isComment && items.length > 0 && h('details', { className: 'office-plan-action__history' },
            h('summary', null, `View plan comments (${items.length}${last > 1 ? '+' : ''})`),
            h('div', { className: 'office-plan-action__history-list' }, items.map(item => h('article', { key: item.plan_comment_id },
                h('strong', null, item.submitter_name || 'Office user'), h('p', null, item.content))),
                last > 1 && h('div', { className: 'office-pagination' },
                    h('button', { type: 'button', disabled: page <= 1, onClick: () => setPage(page - 1) }, 'Previous'),
                    h('span', null, `${page} / ${last}`),
                    h('button', { type: 'button', disabled: page >= last, onClick: () => setPage(page + 1) }, 'Next')))),
        allowed ? h('form', { onSubmit: submit, className: `office-plan-action__form ${isComment ? '' : 'office-plan-action__form--proposal'}` },
            isComment ? h('label', { className: 'office-plan-action__field', htmlFor: 'office-plan-comment' }, 'Your comment',
                h('textarea', { id: 'office-plan-comment', value: comment, onChange: event => setComment(event.target.value),
                    required: true, maxLength: 10000, rows: 3, disabled: busy, placeholder: 'Comment on the initial plan contents…' }))
                : proposalFields.map(([key, label, required]) => h('label', { className: 'office-plan-action__field', key }, label,
                    h('input', { value: proposal[key], onChange: event => setProposal(current => ({ ...current, [key]: event.target.value })),
                        required, maxLength: 5000, disabled: busy, placeholder: label }))),
            h('button', { type: 'submit', className: 'ui-button ui-button--primary',
                disabled: busy || (isComment ? !comment.trim() : !proposal.objective_title.trim()) },
                busy ? 'Submitting…' : isComment ? 'Submit Comment' : 'Submit Proposed Objective'))
            : h('p', { className: 'office-muted' }, isComment
                ? 'Your account does not have plan comment permission.'
                : 'Objective proposals require a draft plan and submission permission.'));
}
