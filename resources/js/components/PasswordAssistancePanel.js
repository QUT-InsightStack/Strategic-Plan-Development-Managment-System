import { apiRequest } from '../api/api-client.js';
import { getAccessSession } from '../access/access-session.js';

const { useEffect, useState } = React;
const h = React.createElement;

const labels = {
    pending: 'Pending',
    accepted: 'Accepted',
    acted_on: 'Acted on',
    ignored: 'Ignored',
};

export function PasswordAssistancePanel({ onNotice = () => {} }) {
    const [requests, setRequests] = useState([]);
    const [filter, setFilter] = useState('pending');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({
        last_page: 1,
        pending_count: 0,
    });
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState('');

    async function load() {
        setLoading(true);
        setError('');

        try {
            const payload = await apiRequest(
                `/api/password-assistance-requests?status=${filter}&page=${page}`
            );
            setRequests(payload.data || []);
            setMeta(payload.meta);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, [filter, page]);

    function openAccount(request) {
        window.location.href =
            `/user-management?assistance_id=${request.id}` +
            `&user_id=${request.user_id}`;
    }

    async function act(request, action) {
        if (busy !== null) return;

        if (!window.confirm(
            action === 'accept'
                ? `Accept password assistance for ${request.user_name}?`
                : `Ignore password assistance for ${request.user_name}?`
        )) return;

        setBusy(request.id);
        setError('');

        try {
            const payload = await apiRequest(
                `/api/password-assistance-requests/${request.id}/${action}`,
                { method: 'POST' }
            );

            if (action === 'accept') {
                openAccount(payload.data);
                return;
            }

            onNotice(payload.message, 'success');
            await load();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy(null);
        }
    }

    return h('section', {
        className: 'ui-card password-assistance-panel',
        'aria-labelledby': 'password-assistance-title',
    },
        h('div', { className: 'password-assistance-header' },
            h('h2', { id: 'password-assistance-title' },
                'Password Assistance Requests'
            ),
            h('span', { className: 'password-assistance-count' },
                `${meta.pending_count} Pending`
            )
        ),
        h('p', null,
            'Accept a request to reset the password in User Accounts.'
        ),
        h('div', { className: 'password-assistance-filters' },
            ...Object.entries(labels).map(([status, label]) =>
                h('button', {
                    key: status,
                    type: 'button',
                    className: 'ui-button ui-button--secondary ui-button--sm',
                    'aria-pressed': filter === status,
                    onClick: () => {
                        setFilter(status);
                        setPage(1);
                    },
                }, label)
            ),
            h('button', {
                type: 'button',
                className: 'ui-button ui-button--secondary ui-button--sm',
                disabled: loading || busy !== null,
                onClick: load,
            }, 'Refresh')
        ),
        error && h('p', { className: 'ui-error', role: 'alert' }, error),
        loading
            ? h('p', { role: 'status' }, 'Loading requests…')
            : requests.length === 0
                ? h('p', null, `No ${labels[filter].toLowerCase()} requests.`)
                : h('div', { className: 'password-assistance-table-wrap' },
                    h('table', { className: 'password-assistance-table' },
                        h('thead', null,
                            h('tr', null,
                                ...['User', 'Requested', 'Status', 'Handled by', 'Action']
                                    .map(label => h('th', {
                                        key: label,
                                        scope: 'col',
                                    }, label))
                            )
                        ),
                        h('tbody', null,
                            ...requests.map(request => {
                                const mine =
                                    Number(request.accepted_by) ===
                                    Number(getAccessSession()?.userId);

                                return h('tr', { key: request.id },
                                    h('td', null,
                                        h('strong', null, request.user_name),
                                        h('small', null, request.email || 'Account unavailable')
                                    ),
                                    h('td', null,
                                        new Date(request.requested_at).toLocaleString()
                                    ),
                                    h('td', null, labels[request.status]),
                                    h('td', null,
                                        request.handled_by_name ||
                                        request.accepted_by_name || '—'
                                    ),
                                    h('td', null,
                                        request.status === 'pending' &&
                                            h('button', {
                                                type: 'button',
                                                className: 'ui-button ui-button--primary ui-button--sm',
                                                disabled: busy !== null,
                                                onClick: () => act(request, 'accept'),
                                            }, 'Accept'),
                                        request.status === 'accepted' && mine &&
                                            h('button', {
                                                type: 'button',
                                                className: 'ui-button ui-button--primary ui-button--sm',
                                                onClick: () => openAccount(request),
                                            }, 'Open User Account'),
                                        (request.status === 'pending' ||
                                            (request.status === 'accepted' && mine)) &&
                                            h('button', {
                                                type: 'button',
                                                className: 'ui-button ui-button--secondary ui-button--sm',
                                                disabled: busy !== null,
                                                onClick: () => act(request, 'ignore'),
                                            }, 'Ignore')
                                    )
                                );
                            })
                        )
                    )
                ),
        h('div', { className: 'password-assistance-filters' },
            h('button', {
                type: 'button',
                disabled: loading || page <= 1,
                onClick: () => setPage(current => current - 1),
            }, 'Previous'),
            h('span', null, `Page ${page} of ${meta.last_page}`),
            h('button', {
                type: 'button',
                disabled: loading || page >= meta.last_page,
                onClick: () => setPage(current => current + 1),
            }, 'Next')
        )
    );
}