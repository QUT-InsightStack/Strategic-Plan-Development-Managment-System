import { can } from '../../access/access-session.js';
import { addObjectiveComment, listObjectiveComments } from '../../api/strategic-objectives-api.js';

const h = React.createElement;

export function ObjectiveComments({ plan, objectives = [] }) {
    const [commentsByObjective, setCommentsByObjective] = React.useState({});
    const [drafts, setDrafts] = React.useState({});
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [busyObjective, setBusyObjective] = React.useState(null);
    const [refresh, setRefresh] = React.useState(0);
    const allowed = can('objective_comments.create');

    React.useEffect(() => {
        let active = true;
        setCommentsByObjective({});
        if (!objectives.length) return () => { active = false; };
        Promise.all(objectives.map(async objective => {
            const result = await listObjectiveComments(objective.objective_id);
            return [objective.objective_id, result.data || []];
        })).then(entries => {
            if (active) setCommentsByObjective(Object.fromEntries(entries));
        }).catch(err => {
            if (active) setError(err.message);
        });
        return () => { active = false; };
    }, [plan.record_id, objectives.map(item => item.objective_id).join(','), refresh]);

    async function submit(event, objective) {
        event.preventDefault();
        const content = (drafts[objective.objective_id] || '').trim();
        if (!content || busyObjective) return;
        setBusyObjective(objective.objective_id);
        setError('');
        setMessage('');
        try {
            await addObjectiveComment(objective.objective_id, content);
            setDrafts(current => ({ ...current, [objective.objective_id]: '' }));
            setMessage('Comment submitted.');
            setRefresh(value => value + 1);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyObjective(null);
        }
    }

    return h('section', { className: 'office-detail-notes', id: 'office-comments' },
        h('h2', null, 'Comments on assigned objectives'),
        message && h('p', { role: 'status', 'aria-live': 'polite' }, message),
        error && h('p', { role: 'alert' }, error),
        objectives.length ? objectives.map(objective => {
            const comments = commentsByObjective[objective.objective_id] || [];
            return h('article', { className: 'office-objective-comments', key: objective.objective_id },
                h('h3', null, objective.objective_title || objective.objective_description || `Objective ${objective.objective_id}`),
                comments.length ? comments.map(comment => h('div', { className: 'office-update', key: comment.comment_id },
                    h('strong', null, comment.submitter_name || 'Office user'),
                    h('small', null, ' · ' + (comment.submitted_at ? new Date(comment.submitted_at).toLocaleString() : '')),
                    h('p', null, comment.content))) : h('p', { className: 'office-muted' }, 'No comments yet.'),
                allowed && h('form', { onSubmit: event => submit(event, objective) },
                    h('label', { htmlFor: `office-comment-${objective.objective_id}` }, 'Your comment'),
                    h('textarea', { id: `office-comment-${objective.objective_id}`, required: true, maxLength: 5000,
                        value: drafts[objective.objective_id] || '', onChange: event => setDrafts(current => ({ ...current, [objective.objective_id]: event.target.value })),
                        disabled: busyObjective !== null, rows: 3 }),
                    h('button', { className: 'ui-button ui-button--primary', type: 'submit', disabled: busyObjective !== null || !(drafts[objective.objective_id] || '').trim() },
                        busyObjective === objective.objective_id ? 'Submitting…' : 'Submit comment')));
        }) : h('p', { className: 'office-muted' }, 'Comments become available after objectives are assigned to your Office/Unit.'));
}
