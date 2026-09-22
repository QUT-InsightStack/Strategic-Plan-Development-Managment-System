import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { apiRequest } from '../../api/api-client.js';

enforcePageAccess();
const h = React.createElement;
const { useEffect, useState } = React;

function WorkflowNotificationsApp() {
    const [data, setData] = useState({ data: [], unread_count: 0, last_page: 1 });
    const [page, setPage] = useState(1);
    const [refresh, setRefresh] = useState(0);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        apiRequest(`/api/workflow-notifications?page=${page}`).then(response => { if (active) setData(response); })
            .catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [page, refresh]);
    async function markRead(id) {
        setBusy(id);
        setError('');
        try {
            await apiRequest(`/api/workflow-notifications/${id}/read`, { method: 'PATCH' });
            setRefresh(value => value + 1);
        } catch (error) { setError(error.message); }
        finally { setBusy(null); }
    }
    return h(React.Fragment, null, h(AppSidebar),
        h('main', { className: 'app-shell-main plan-review-page' }, h('div', { className: 'app-shell-container plan-review-container' },
            h(PageHeader, { section: 'Notifications', title: 'Workflow notifications', subtitle: `${data.unread_count} unread notification(s)`,
                actions: h('button', { className: 'ui-button ui-button--secondary', disabled: loading, onClick: () => setRefresh(value => value + 1) }, 'Refresh'),
            }),
            error && h('p', { className: 'ui-status ui-status--error', role: 'alert' }, error),
            loading ? h('p', { role: 'status' }, 'Loading notifications…') : data.data.length ? data.data.map(notification =>
                h('article', { key: notification.id, className: 'ui-card' }, h('div', { className: 'ui-card__body' },
                    h('h2', null, `${notification.read_at ? '' : 'Unread · '}${notification.payload.title}`),
                    h('p', null, `${notification.payload.actor} ${notification.payload.action} the plan at ${notification.payload.stage}.`),
                    notification.payload.next_stage && h('p', null, `Next stage: ${notification.payload.next_stage}`),
                    notification.payload.comment && h('p', null, notification.payload.comment),
                    h('p', null, new Date(notification.created_at).toLocaleString()),
                    h('a', { className: 'ui-button ui-button--secondary', href: notification.payload.url }, 'View approval status'),
                    !notification.read_at && h('button', { className: 'ui-button ui-button--primary', disabled: busy !== null, onClick: () => markRead(notification.id) }, busy === notification.id ? 'Saving…' : 'Mark as read'),
                ))) : h('p', null, 'No workflow notifications yet.'),
            h('div', { className: 'plans-pagination' },
                h('button', { className: 'ui-button ui-button--secondary', disabled: loading || page === 1, onClick: () => setPage(value => value - 1) }, 'Previous'),
                h('span', null, `Page ${page} of ${data.last_page}`),
                h('button', { className: 'ui-button ui-button--secondary', disabled: loading || page >= data.last_page, onClick: () => setPage(value => value + 1) }, 'Next'),
            ),
        )),
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(h(WorkflowNotificationsApp));
