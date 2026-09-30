import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { apiRequest } from '../../api/api-client.js';

enforcePageAccess();

const h = React.createElement;
const { useEffect, useMemo, useState } = React;

const eventPresentation = {
    submitted: {
        icon: 'bi-send-fill',
        label: 'Submitted',
        className: 'is-submitted',
        message: 'submitted the Strategic Plan for approval',
    },
    approved: {
        icon: 'bi-check-circle-fill',
        label: 'Approved',
        className: 'is-approved',
        message: 'approved the Strategic Plan',
    },
    rejected: {
        icon: 'bi-x-circle-fill',
        label: 'Rejected',
        className: 'is-rejected',
        message: 'rejected the Strategic Plan',
    },
    resubmitted: {
        icon: 'bi-arrow-repeat',
        label: 'Resubmitted',
        className: 'is-resubmitted',
        message: 'resubmitted the Strategic Plan for approval',
    },
};

function presentationFor(action) {
    const normalizedAction = String(action || '').toLowerCase();

    return eventPresentation[normalizedAction] || {
        icon: 'bi-bell-fill',
        label: normalizedAction
            ? normalizedAction.replaceAll('_', ' ')
            : 'Workflow update',
        className: '',
        message: 'updated the Strategic Plan workflow',
    };
}

function formatDate(value) {
    if (!value) {
        return 'Date unavailable';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

function WorkflowNotificationCard({ notification, busy, onMarkRead }) {
    const payload = notification.payload || {};
    const presentation = presentationFor(payload.action);
    const isUnread = !notification.read_at;

    return h(
        'article',
        {
            className: [
                'workflow-notification',
                presentation.className,
                isUnread ? 'is-unread' : 'is-read',
            ].filter(Boolean).join(' '),
        },
        h(
            'span',
            {
                className: 'workflow-notification__icon',
                'aria-hidden': 'true',
            },
            h('i', { className: `bi ${presentation.icon}` })
        ),
        h(
            'div',
            { className: 'workflow-notification__content' },
            h(
                'div',
                { className: 'workflow-notification__heading' },
                h(
                    'h2',
                    { className: 'workflow-notification__title' },
                    payload.title || 'Strategic Plan'
                ),
                h(
                    'span',
                    {
                        className:
                            `notification-badge ${presentation.className}`,
                    },
                    presentation.label
                ),
                h(
                    'span',
                    {
                        className:
                            `notification-badge ${isUnread ? '' : 'is-read'}`,
                    },
                    h('i', {
                        className: `bi ${
                            isUnread
                                ? 'bi-circle-fill'
                                : 'bi-check2'
                        }`,
                        'aria-hidden': 'true',
                    }),
                    isUnread ? 'Unread' : 'Read'
                )
            ),
            h(
                'p',
                { className: 'workflow-notification__message' },
                h('strong', null, payload.actor || 'A workflow participant'),
                ` ${presentation.message}`,
                payload.stage ? ` at “${payload.stage}”.` : '.'
            ),
            h(
                'p',
                { className: 'workflow-notification__meta' },
                payload.stage
                    ? h(
                        'span',
                        null,
                        h('i', {
                            className: 'bi bi-diagram-3',
                            'aria-hidden': 'true',
                        }),
                        `Stage: ${payload.stage}`
                    )
                    : null,
                payload.next_stage
                    ? h(
                        'span',
                        null,
                        h('i', {
                            className: 'bi bi-arrow-right-circle',
                            'aria-hidden': 'true',
                        }),
                        `Next stage: ${payload.next_stage}`
                    )
                    : null,
                h(
                    'span',
                    null,
                    h('i', {
                        className: 'bi bi-clock',
                        'aria-hidden': 'true',
                    }),
                    formatDate(notification.created_at)
                ),
                h(
                    'span',
                    null,
                    h('i', {
                        className: 'bi bi-send-check',
                        'aria-hidden': 'true',
                    }),
                    notification.status === 'sent'
                        ? 'Delivered'
                        : notification.status || 'Recorded'
                )
            ),
            payload.comment
                ? h(
                    'blockquote',
                    { className: 'workflow-notification__comment' },
                    payload.comment
                )
                : null
        ),
        h(
            'div',
            { className: 'workflow-notification__actions' },
            payload.url
                ? h(
                    'a',
                    {
                        className:
                            'ui-button ui-button--secondary ui-button--sm',
                        href: payload.url,
                    },
                    h('i', {
                        className: 'bi bi-eye',
                        'aria-hidden': 'true',
                    }),
                    'View approval status'
                )
                : null,
            isUnread
                ? h(
                    'button',
                    {
                        className:
                            'ui-button ui-button--primary ui-button--sm',
                        type: 'button',
                        disabled: busy !== null,
                        onClick: () => onMarkRead(notification.id),
                    },
                    h('i', {
                        className: 'bi bi-check2',
                        'aria-hidden': 'true',
                    }),
                    busy === notification.id
                        ? 'Saving…'
                        : 'Mark as read'
                )
                : null
        )
    );
}

function WorkflowNotificationsApp() {
    const [data, setData] = useState({
        data: [],
        unread_count: 0,
        total: 0,
        last_page: 1,
    });
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState('all');
    const [refreshKey, setRefreshKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;

        async function loadNotifications() {
            setLoading(true);
            setError('');

            try {
                const response = await apiRequest(
                    `/api/workflow-notifications?page=${page}`
                );

                if (active) {
                    setData({
                        ...response,
                        data: response.data || [],
                        unread_count: response.unread_count || 0,
                        total: response.total || 0,
                        last_page: response.last_page || 1,
                    });
                }
            } catch (requestError) {
                if (active) {
                    setError(
                        requestError.message ||
                        'Workflow notifications could not be loaded.'
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadNotifications();

        return () => {
            active = false;
        };
    }, [page, refreshKey]);

    const visibleNotifications = useMemo(() => {
        if (filter === 'unread') {
            return data.data.filter(notification => !notification.read_at);
        }

        return data.data;
    }, [data.data, filter]);

    const readCount = Math.max(
        Number(data.total || 0) - Number(data.unread_count || 0),
        0
    );

    async function markRead(id) {
        setBusy(id);
        setError('');

        try {
            const response = await apiRequest(
                `/api/workflow-notifications/${id}/read`,
                { method: 'PATCH' }
            );

            setData(current => ({
                ...current,
                unread_count: Math.max(current.unread_count - 1, 0),
                data: current.data.map(notification =>
                    notification.id === id
                        ? {
                            ...notification,
                            ...(response.data || {}),
                            read_at:
                                response.data?.read_at ||
                                new Date().toISOString(),
                        }
                        : notification
                ),
            }));
        } catch (requestError) {
            setError(
                requestError.message ||
                'The notification could not be marked as read.'
            );
        } finally {
            setBusy(null);
        }
    }

    function refreshNotifications() {
        setRefreshKey(value => value + 1);
    }

    return h(
        React.Fragment,
        null,
        h(AppSidebar),
        h(
            'main',
            {
                className:
                    'app-shell-main workflow-notifications-page',
            },
            h(
                'div',
                {
                    className:
                        'app-shell-container workflow-notifications-container',
                },
                h(PageHeader, {
                    section: 'Notifications',
                    title: 'Workflow notifications',
                    subtitle:
                        'Review approval activity for your Strategic Plans.',
                    actions: h(
                        'button',
                        {
                            className: 'ui-button ui-button--secondary',
                            type: 'button',
                            disabled: loading,
                            onClick: refreshNotifications,
                        },
                        h('i', {
                            className: 'bi bi-arrow-clockwise',
                            'aria-hidden': 'true',
                        }),
                        loading ? 'Refreshing…' : 'Refresh'
                    ),
                }),
                h(
                    'section',
                    {
                        className: 'notification-summary',
                        'aria-label': 'Notification summary',
                    },
                    h(
                        'article',
                        { className: 'notification-summary__card' },
                        h(
                            'span',
                            { className: 'notification-summary__icon' },
                            h('i', {
                                className: 'bi bi-bell',
                                'aria-hidden': 'true',
                            })
                        ),
                        h(
                            'div',
                            null,
                            h(
                                'span',
                                { className: 'notification-summary__label' },
                                'Total notifications'
                            ),
                            h(
                                'strong',
                                { className: 'notification-summary__value' },
                                data.total
                            )
                        )
                    ),
                    h(
                        'article',
                        {
                            className:
                                'notification-summary__card is-unread',
                        },
                        h(
                            'span',
                            { className: 'notification-summary__icon' },
                            h('i', {
                                className: 'bi bi-envelope',
                                'aria-hidden': 'true',
                            })
                        ),
                        h(
                            'div',
                            null,
                            h(
                                'span',
                                { className: 'notification-summary__label' },
                                'Unread'
                            ),
                            h(
                                'strong',
                                { className: 'notification-summary__value' },
                                data.unread_count
                            )
                        )
                    ),
                    h(
                        'article',
                        {
                            className:
                                'notification-summary__card is-read',
                        },
                        h(
                            'span',
                            { className: 'notification-summary__icon' },
                            h('i', {
                                className: 'bi bi-envelope-check',
                                'aria-hidden': 'true',
                            })
                        ),
                        h(
                            'div',
                            null,
                            h(
                                'span',
                                { className: 'notification-summary__label' },
                                'Read'
                            ),
                            h(
                                'strong',
                                { className: 'notification-summary__value' },
                                readCount
                            )
                        )
                    )
                ),
                h(
                    'section',
                    {
                        className: 'notification-toolbar',
                        'aria-label': 'Notification filters',
                    },
                    h(
                        'div',
                        {
                            className: 'notification-tabs',
                            role: 'group',
                            'aria-label': 'Filter notifications',
                        },
                        h(
                            'button',
                            {
                                className:
                                    `notification-tab ${
                                        filter === 'all'
                                            ? 'is-active'
                                            : ''
                                    }`,
                                type: 'button',
                                'aria-pressed': filter === 'all',
                                onClick: () => setFilter('all'),
                            },
                            'All'
                        ),
                        h(
                            'button',
                            {
                                className:
                                    `notification-tab ${
                                        filter === 'unread'
                                            ? 'is-active'
                                            : ''
                                    }`,
                                type: 'button',
                                'aria-pressed': filter === 'unread',
                                onClick: () => setFilter('unread'),
                            },
                            'Unread'
                        )
                    ),
                    h(
                        'p',
                        { className: 'notification-toolbar__count' },
                        loading
                            ? 'Loading notifications…'
                            : `${visibleNotifications.length} notification(s) shown on this page`
                    )
                ),
                error
                    ? h(
                        'div',
                        {
                            className: 'ui-status ui-status--error',
                            role: 'alert',
                        },
                        error,
                        h(
                            'button',
                            {
                                className:
                                    'ui-button ui-button--secondary ui-button--sm',
                                type: 'button',
                                onClick: refreshNotifications,
                            },
                            'Try again'
                        )
                    )
                    : null,
                loading
                    ? h(
                        'section',
                        {
                            className: 'notification-loading',
                            role: 'status',
                        },
                        h('i', {
                            className: 'bi bi-arrow-repeat',
                            'aria-hidden': 'true',
                        }),
                        h('p', null, 'Loading workflow notifications…')
                    )
                    : visibleNotifications.length
                        ? h(
                            'section',
                            {
                                className: 'notification-list',
                                'aria-label': 'Workflow notifications',
                            },
                            visibleNotifications.map(notification =>
                                h(WorkflowNotificationCard, {
                                    key: notification.id,
                                    notification,
                                    busy,
                                    onMarkRead: markRead,
                                })
                            )
                        )
                        : h(
                            'section',
                            { className: 'notification-empty' },
                            h('i', {
                                className:
                                    filter === 'unread'
                                        ? 'bi bi-envelope-check'
                                        : 'bi bi-bell-slash',
                                'aria-hidden': 'true',
                            }),
                            h(
                                'h2',
                                null,
                                filter === 'unread'
                                    ? 'You are all caught up'
                                    : 'No workflow notifications yet'
                            ),
                            h(
                                'p',
                                null,
                                filter === 'unread'
                                    ? 'There are no unread notifications on this page.'
                                    : 'Notifications will appear when a Strategic Plan is submitted, approved, rejected or resubmitted.'
                            )
                        ),
                h(
                    'nav',
                    {
                        className: 'notification-pagination',
                        'aria-label': 'Notification pages',
                    },
                    h(
                        'button',
                        {
                            className: 'ui-button ui-button--secondary',
                            type: 'button',
                            disabled: loading || page <= 1,
                            onClick: () =>
                                setPage(currentPage =>
                                    Math.max(currentPage - 1, 1)
                                ),
                        },
                        'Previous'
                    ),
                    h(
                        'span',
                        { className: 'notification-pagination__label' },
                        `Page ${page} of ${data.last_page}`
                    ),
                    h(
                        'button',
                        {
                            className: 'ui-button ui-button--secondary',
                            type: 'button',
                            disabled:
                                loading || page >= data.last_page,
                            onClick: () =>
                                setPage(currentPage => currentPage + 1),
                        },
                        'Next'
                    )
                )
            )
        )
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    h(WorkflowNotificationsApp)
);