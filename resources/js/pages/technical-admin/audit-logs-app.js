import { enforcePageAccess } from '../../access/access-guard.js';
import { listLogs } from '../../api/logs-api.js';
import { searchUsers } from '../../api/users-api.js';
import { PageHeader } from '../../components/PageHeader.js';
import { TechnicalAdminSidebar } from '../../components/TechnicalAdminSidebar.js';

enforcePageAccess();

const { useEffect, useState } = React;

const initialFilters = {
    search: '',
    user_id: '',
    action: '',
    resource_type: '',
    outcome: '',
    date_from: '',
    date_to: '',
};

const OUTCOME_BADGES = { success: 'success', failure: 'danger', denied: 'warning' };
const OUTCOME_LABELS = { success: 'Success', failure: 'Failure', denied: 'Denied' };

function formatTimestamp(value) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
}

/**
 * Actions are recorded as dotted codes such as `auth.password_changed`.
 * Presented as written, because the code is the thing an administrator will
 * quote in an incident, and prettifying it would break that.
 */
function describeResource(resource) {
    if (!resource || !resource.type) return '—';
    return resource.id !== null && resource.id !== undefined
        ? `${resource.type} #${resource.id}`
        : resource.type;
}

function actorName(entry) {
    if (entry.user && entry.user.name) return entry.user.name;
    // actor_name is retained on the record so a deleted account still shows
    // who acted.
    if (entry.actor_name) return entry.actor_name;
    return 'Unknown';
}

/**
 * Renders the recorded before/after state and metadata.
 *
 * Both are stored as JSON of no fixed shape, so they are shown as formatted
 * JSON rather than guessed at with a field list.
 */
function DetailBlock({ title, value }) {
    const isEmpty = value === null || value === undefined
        || (typeof value === 'object' && Object.keys(value).length === 0);

    return React.createElement('div', { className: 'audit-detail__block' },
        React.createElement('h4', null, title),
        isEmpty
            ? React.createElement('p', { className: 'audit-detail__empty' }, 'Nothing recorded.')
            : React.createElement('pre', null, typeof value === 'string' ? value : JSON.stringify(value, null, 2))
    );
}

function LogDetail({ entry, onClose }) {
    if (!entry) return null;

    return React.createElement('div', {
        className: 'audit-detail-backdrop',
        role: 'presentation',
        onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); },
    },
        React.createElement('section', {
            className: 'ui-card audit-detail',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'audit-detail-title',
        },
            React.createElement('header', { className: 'audit-detail__header' },
                React.createElement('div', null,
                    React.createElement('h2', { id: 'audit-detail-title' }, entry.action),
                    React.createElement('p', null, formatTimestamp(entry.occurred_at))
                ),
                React.createElement('button', {
                    className: 'audit-detail__close',
                    type: 'button',
                    'aria-label': 'Close',
                    onClick: onClose,
                }, React.createElement('i', { className: 'bi bi-x-lg', 'aria-hidden': 'true' }))
            ),
            React.createElement('div', { className: 'audit-detail__body' },
                React.createElement('dl', { className: 'audit-detail__facts' },
                    React.createElement('div', null,
                        React.createElement('dt', null, 'Performed by'),
                        React.createElement('dd', null, actorName(entry),
                            entry.user && entry.user.email
                                ? React.createElement('span', { className: 'audit-detail__sub' }, entry.user.email)
                                : null)
                    ),
                    React.createElement('div', null,
                        React.createElement('dt', null, 'Outcome'),
                        React.createElement('dd', null,
                            React.createElement('span', { className: `ui-badge ui-badge--${OUTCOME_BADGES[entry.outcome] || 'neutral'}` },
                                OUTCOME_LABELS[entry.outcome] || entry.outcome || 'Unknown'))
                    ),
                    React.createElement('div', null,
                        React.createElement('dt', null, 'Resource'),
                        React.createElement('dd', null, describeResource(entry.resource))
                    ),
                    React.createElement('div', null,
                        React.createElement('dt', null, 'Record'),
                        React.createElement('dd', { className: 'audit-detail__id' }, `#${entry.log_id}`)
                    )
                ),
                React.createElement(DetailBlock, { title: 'Recorded state', value: entry.state }),
                React.createElement(DetailBlock, { title: 'Metadata', value: entry.metadata })
            )
        )
    );
}

function AuditLogsApp() {
    const [entries, setEntries] = useState([]);
    const [users, setUsers] = useState([]);
    const [filters, setFilters] = useState(initialFilters);
    const [appliedFilters, setAppliedFilters] = useState(initialFilters);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState({ type: '', message: '' });
    const [errors, setErrors] = useState({});
    const [selected, setSelected] = useState(null);

    async function loadLogs(page = 1, nextFilters = appliedFilters) {
        setLoading(true);
        setErrors({});

        try {
            const payload = await listLogs({ ...nextFilters, page, per_page: 15 });
            setEntries(payload.data || []);
            setMeta(payload.meta || { current_page: 1, last_page: 1, total: 0 });
        } catch (error) {
            setErrors(error.errors || {});
            setNotice({ type: 'error', message: error.message });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadLogs(1);

        // Populates the user filter. A failure here must not break the page —
        // the trail itself is the point, so the filter just stays empty.
        searchUsers({ page: 1, per_page: 100, sort_by: 'name' })
            .then((payload) => setUsers(payload.data || []))
            .catch(() => setUsers([]));
    }, []);

    function applyFilters(event) {
        event.preventDefault();
        setAppliedFilters(filters);
        loadLogs(1, filters);
    }

    function clearFilters() {
        setFilters(initialFilters);
        setAppliedFilters(initialFilters);
        loadLogs(1, initialFilters);
    }

    function field(id, label, control, error) {
        return React.createElement('div', { className: `ui-field${error ? ' is-invalid' : ''}` },
            React.createElement('label', { className: 'ui-label', htmlFor: id }, label),
            control,
            error ? React.createElement('p', { className: 'ui-error' }, error) : null
        );
    }

    return React.createElement(React.Fragment, null,
        React.createElement(TechnicalAdminSidebar, {
            active: 'Audit Logs',
            onNotice: (message) => setNotice({ type: 'info', message }),
        }),
        React.createElement('main', { className: 'app-shell-main audit-logs-page' },
            React.createElement('div', { className: 'app-shell-container' },
                React.createElement(PageHeader, {
                    section: 'Technical Administration',
                    title: 'Audit Logs',
                    subtitle: 'Every recorded action across the system, who performed it, and what it changed.',
                }),

                notice.message
                    ? React.createElement('div', { className: `ui-status ui-status--${notice.type}`, role: 'status', 'aria-live': 'polite' }, notice.message)
                    : null,

                React.createElement('section', { className: 'ui-card', 'aria-labelledby': 'audit-filter-title' },
                    React.createElement('div', { className: 'ui-section-header' },
                        React.createElement('div', { className: 'ui-section-header__copy' },
                            React.createElement('h2', { id: 'audit-filter-title' }, 'Find recorded activity'),
                            React.createElement('p', null, 'Narrow the trail by account, action, resource, outcome or date range.')
                        ),
                        React.createElement('i', { className: 'bi bi-funnel', 'aria-hidden': 'true' })
                    ),
                    React.createElement('div', { className: 'ui-card__body' },
                        React.createElement('form', { className: 'audit-filters', onSubmit: applyFilters },
                            field('audit-search', 'Search',
                                React.createElement('input', {
                                    id: 'audit-search',
                                    className: 'ui-input',
                                    value: filters.search,
                                    placeholder: 'Search actions, actors or resources',
                                    maxLength: 100,
                                    onChange: (event) => setFilters((current) => ({ ...current, search: event.target.value })),
                                }), errors.search && errors.search[0]),

                            field('audit-user', 'User',
                                React.createElement('select', {
                                    id: 'audit-user',
                                    className: 'ui-select',
                                    value: filters.user_id,
                                    onChange: (event) => setFilters((current) => ({ ...current, user_id: event.target.value })),
                                },
                                    React.createElement('option', { value: '' }, 'All users'),
                                    users.map((user) => React.createElement('option', { key: user.user_id, value: user.user_id }, user.name || user.email))
                                ), errors.user_id && errors.user_id[0]),

                            field('audit-action', 'Action',
                                React.createElement('input', {
                                    id: 'audit-action',
                                    className: 'ui-input',
                                    value: filters.action,
                                    placeholder: 'e.g. auth.password_changed',
                                    maxLength: 150,
                                    onChange: (event) => setFilters((current) => ({ ...current, action: event.target.value })),
                                }), errors.action && errors.action[0]),

                            field('audit-resource', 'Resource type',
                                React.createElement('input', {
                                    id: 'audit-resource',
                                    className: 'ui-input',
                                    value: filters.resource_type,
                                    placeholder: 'e.g. user',
                                    maxLength: 100,
                                    onChange: (event) => setFilters((current) => ({ ...current, resource_type: event.target.value })),
                                }), errors.resource_type && errors.resource_type[0]),

                            field('audit-outcome', 'Outcome',
                                React.createElement('select', {
                                    id: 'audit-outcome',
                                    className: 'ui-select',
                                    value: filters.outcome,
                                    onChange: (event) => setFilters((current) => ({ ...current, outcome: event.target.value })),
                                },
                                    React.createElement('option', { value: '' }, 'All outcomes'),
                                    React.createElement('option', { value: 'success' }, 'Success'),
                                    React.createElement('option', { value: 'failure' }, 'Failure'),
                                    React.createElement('option', { value: 'denied' }, 'Denied')
                                ), errors.outcome && errors.outcome[0]),

                            field('audit-from', 'From',
                                React.createElement('input', {
                                    id: 'audit-from',
                                    className: 'ui-input',
                                    type: 'date',
                                    value: filters.date_from,
                                    onChange: (event) => setFilters((current) => ({ ...current, date_from: event.target.value })),
                                }), errors.date_from && errors.date_from[0]),

                            field('audit-to', 'To',
                                React.createElement('input', {
                                    id: 'audit-to',
                                    className: 'ui-input',
                                    type: 'date',
                                    value: filters.date_to,
                                    onChange: (event) => setFilters((current) => ({ ...current, date_to: event.target.value })),
                                }), errors.date_to && errors.date_to[0]),

                            React.createElement('div', { className: 'audit-filter-actions' },
                                React.createElement('button', { className: 'ui-button ui-button--primary', type: 'submit', disabled: loading },
                                    React.createElement('i', { className: 'bi bi-search', 'aria-hidden': 'true' }), 'Apply filters'),
                                React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: clearFilters, disabled: loading }, 'Clear')
                            )
                        )
                    )
                ),

                React.createElement('section', { className: 'ui-card', 'aria-labelledby': 'audit-results-title' },
                    React.createElement('div', { className: 'ui-section-header' },
                        React.createElement('div', { className: 'ui-section-header__copy' },
                            React.createElement('h2', { id: 'audit-results-title' }, 'Recorded activity'),
                            React.createElement('p', null, loading
                                ? 'Loading the audit trail…'
                                : `${meta.total || 0} record${meta.total === 1 ? '' : 's'} match the current filters`)
                        ),
                        React.createElement('i', { className: 'bi bi-journal-check', 'aria-hidden': 'true' })
                    ),
                    React.createElement('div', { className: 'ui-card__body' },
                        loading
                            ? React.createElement('p', { className: 'ui-empty' }, 'Loading the audit trail…')
                            : entries.length === 0
                                ? React.createElement('p', { className: 'ui-empty' }, 'No recorded activity matches the current filters.')
                                : React.createElement('div', { className: 'ui-table-wrap' },
                                    React.createElement('table', { className: 'ui-table audit-table' },
                                        React.createElement('thead', null,
                                            React.createElement('tr', null,
                                                ['When', 'Performed by', 'Action', 'Resource', 'Outcome', ''].map((heading, index) =>
                                                    React.createElement('th', { key: heading || `actions-${index}`, scope: 'col' }, heading))
                                            )
                                        ),
                                        React.createElement('tbody', null,
                                            entries.map((entry) => React.createElement('tr', { key: entry.log_id },
                                                React.createElement('td', { className: 'audit-when' }, formatTimestamp(entry.occurred_at)),
                                                React.createElement('td', null,
                                                    React.createElement('strong', null, actorName(entry)),
                                                    entry.user && entry.user.email
                                                        ? React.createElement('span', { className: 'audit-email' }, entry.user.email)
                                                        : null
                                                ),
                                                React.createElement('td', null, React.createElement('code', { className: 'audit-action' }, entry.action || '—')),
                                                React.createElement('td', null, describeResource(entry.resource)),
                                                React.createElement('td', null,
                                                    React.createElement('span', { className: `ui-badge ui-badge--${OUTCOME_BADGES[entry.outcome] || 'neutral'}` },
                                                        OUTCOME_LABELS[entry.outcome] || entry.outcome || 'Unknown')
                                                ),
                                                React.createElement('td', null,
                                                    React.createElement('button', {
                                                        className: 'ui-button ui-button--secondary ui-button--sm',
                                                        type: 'button',
                                                        onClick: () => setSelected(entry),
                                                    }, 'Details')
                                                )
                                            ))
                                        )
                                    )
                                ),

                        meta.last_page > 1
                            ? React.createElement('div', { className: 'ui-pagination' },
                                React.createElement('span', null, `Page ${meta.current_page} of ${meta.last_page} · ${meta.total} records`),
                                React.createElement('div', { className: 'ui-pagination__actions' },
                                    React.createElement('button', {
                                        className: 'ui-button ui-button--secondary ui-button--sm',
                                        type: 'button',
                                        disabled: loading || meta.current_page <= 1,
                                        onClick: () => loadLogs(meta.current_page - 1),
                                    }, React.createElement('i', { className: 'bi bi-chevron-left', 'aria-hidden': 'true' }), 'Previous'),
                                    React.createElement('button', {
                                        className: 'ui-button ui-button--secondary ui-button--sm',
                                        type: 'button',
                                        disabled: loading || meta.current_page >= meta.last_page,
                                        onClick: () => loadLogs(meta.current_page + 1),
                                    }, 'Next', React.createElement('i', { className: 'bi bi-chevron-right', 'aria-hidden': 'true' }))
                                )
                            )
                            : null
                    )
                )
            )
        ),
        React.createElement(LogDetail, { entry: selected, onClose: () => setSelected(null) })
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AuditLogsApp));
