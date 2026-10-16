import { apiRequest } from '../api/api-client.js';
import { getAccessSession } from '../access/access-session.js';
import '../../css/components/password-assistance.css';

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
        h('div', { className: 'ui-section-header password-assistance-header' },
            h('div', { className: 'ui-section-header__copy' },
                h('h2', { id: 'password-assistance-title' }, 'Password Assistance Requests'),
                h('p', null, 'Accept a request to reset the password in User Accounts.')),
            h('span', { className: `password-assistance-count${meta.pending_count ? ' has-pending' : ''}` },
                h('i', { className: 'bi bi-key', 'aria-hidden': true }), `${meta.pending_count} Pending`)),
        h('div', { className: 'password-assistance-toolbar' },
            h('div', { className: 'password-assistance-filters', role: 'group', 'aria-label': 'Request status' },
                ...Object.entries(labels).map(([status, label]) =>
                    h('button', {
                        key: status,
                        type: 'button',
                        className: `password-assistance-filter${filter === status ? ' is-active' : ''}`,
                        'aria-pressed': filter === status,
                        onClick: () => {
                            setFilter(status);
                            setPage(1);
                        },
                    }, label))),
            h('button', {
                type: 'button',
                className: 'ui-button ui-button--secondary ui-button--sm',
                disabled: loading || busy !== null,
                onClick: load,
            }, h('i', { className: 'bi bi-arrow-clockwise', 'aria-hidden': true }), 'Refresh')),
        error && h('p', { className: 'ui-status ui-status--error password-assistance-message', role: 'alert' }, error),
        loading
            ? h('p', { className: 'password-assistance-empty', role: 'status' }, 'Loading requests…')
            : requests.length === 0
                ? h('p', { className: 'password-assistance-empty' }, `No ${labels[filter].toLowerCase()} requests.`)
                : h('div', { className: 'ui-table-wrap password-assistance-table-wrap' },
                    h('table', { className: 'ui-table password-assistance-table' },
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
                                    h('td', null, h('span', { className: `ui-badge ui-badge--${request.status === 'pending' ? 'warning' : request.status === 'ignored' ? 'neutral' : 'success'}` }, labels[request.status])),
                                    h('td', null,
                                        request.handled_by_name ||
                                        request.accepted_by_name || '—'
                                    ),
                                    h('td', null, h('div', { className: 'ui-table__actions' },
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
                                    ))
                                );
                            })
                        )
                    )
                ),
        meta.last_page > 1 ? h('div', { className: 'password-assistance-pagination' },
            h('button', {
                type: 'button',
                className: 'ui-button ui-button--secondary ui-button--sm',
                disabled: loading || page <= 1,
                onClick: () => setPage(current => current - 1),
            }, h('i', { className: 'bi bi-chevron-left', 'aria-hidden': true }), 'Previous'),
            h('span', null, `Page ${page} of ${meta.last_page}`),
            h('button', {
                type: 'button',
                className: 'ui-button ui-button--secondary ui-button--sm',
                disabled: loading || page >= meta.last_page,
                onClick: () => setPage(current => current + 1),
            }, 'Next', h('i', { className: 'bi bi-chevron-right', 'aria-hidden': true }))) : null
    );
}