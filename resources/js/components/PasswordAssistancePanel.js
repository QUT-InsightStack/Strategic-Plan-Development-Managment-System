import { passwordAssistanceDemoRequests } from '../data/password-assistance-demo-data.js';

const { useMemo, useState } = React;

function formatDateTime(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString();
}

export function PasswordAssistancePanel({ onNotice = () => {} }) {
    const [requests, setRequests] = useState(
        passwordAssistanceDemoRequests.map((request) => ({ ...request }))
    );
    const [filter, setFilter] = useState('pending');

    const filteredRequests = useMemo(
        () => requests.filter((request) => request.status === filter),
        [requests, filter]
    );

    const pendingCount = requests.filter(
        (request) => request.status === 'pending'
    ).length;

    function markResolved(requestId) {
        setRequests((current) =>
            current.map((request) =>
                request.id === requestId
                    ? {
                        ...request,
                        status: 'resolved',
                        handledBy: 'Current Administrator',
                        handledAt: new Date().toISOString(),
                    }
                    : request
            )
        );

        onNotice(
            'Password assistance request marked as resolved in the frontend demonstration.',
            'success'
        );
    }

    return React.createElement(
        'section',
        {
            className: 'password-assistance-panel',
            'aria-labelledby': 'password-assistance-title',
        },
        React.createElement(
            'div',
            { className: 'password-assistance-header' },
            React.createElement(
                'div',
                null,
                React.createElement(
                    'h2',
                    { id: 'password-assistance-title' },
                    'Password Assistance Requests'
                ),
                React.createElement(
                    'p',
                    null,
                    'Review password assistance requests submitted by active users- Frontend demonstration — awaiting backend integration.'
                )
            ),
            React.createElement(
                'span',
                {
                    className: 'password-assistance-count',
                    'aria-label': `${pendingCount} pending requests`,
                },
                `${pendingCount} Pending`
            )
        ),
        React.createElement(
            'div',
            {
                className: 'password-assistance-filters',
                role: 'group',
                'aria-label': 'Filter password assistance requests',
            },
            ['pending', 'resolved'].map((status) =>
                React.createElement(
                    'button',
                    {
                        key: status,
                        type: 'button',
                        className:
                            `password-assistance-filter${filter === status ? ' is-active' : ''}`,
                        onClick: () => setFilter(status),
                        'aria-pressed': filter === status,
                    },
                    status === 'pending' ? 'Pending' : 'Resolved'
                )
            )
        ),
        filteredRequests.length === 0
            ? React.createElement(
                'p',
                { className: 'password-assistance-empty' },
                `No ${filter} password assistance requests.`
            )
            : React.createElement(
                'div',
                { className: 'password-assistance-table-wrap' },
                React.createElement(
                    'table',
                    { className: 'password-assistance-table' },
                    React.createElement(
                        'thead',
                        null,
                        React.createElement(
                            'tr',
                            null,
                            React.createElement('th', { scope: 'col' }, 'User'),
                            React.createElement('th', { scope: 'col' }, 'Requested'),
                            React.createElement('th', { scope: 'col' }, 'Status'),
                            React.createElement('th', { scope: 'col' }, 'Handled By'),
                            React.createElement('th', { scope: 'col' }, 'Action')
                        )
                    ),
                    React.createElement(
                        'tbody',
                        null,
                        filteredRequests.map((request) =>
                            React.createElement(
                                'tr',
                                { key: request.id },
                                React.createElement(
                                    'td',
                                    null,
                                    React.createElement('strong', null, request.userName),
                                    React.createElement('small', null, request.email)
                                ),
                                React.createElement(
                                    'td',
                                    null,
                                    formatDateTime(request.requestedAt)
                                ),
                                React.createElement(
                                    'td',
                                    null,
                                    React.createElement(
                                        'span',
                                        {
                                            className:
                                                `password-assistance-status is-${request.status}`,
                                        },
                                        request.status === 'pending'
                                            ? 'Pending'
                                            : 'Resolved'
                                    )
                                ),
                                React.createElement(
                                    'td',
                                    null,
                                    request.handledBy || '—'
                                ),
                                React.createElement(
                                    'td',
                                    null,
                                    request.status === 'pending'
                                        ? React.createElement(
                                            'button',
                                            {
                                                className:
                                                    'action-button primary password-assistance-resolve',
                                                type: 'button',
                                                onClick: () =>
                                                    markResolved(request.id),
                                            },
                                            'Mark as Resolved'
                                        )
                                        : React.createElement(
                                            'span',
                                            { className: 'password-assistance-complete' },
                                            formatDateTime(request.handledAt)
                                        )
                                )
                            )
                        )
                    )
                )
            )
    );
}