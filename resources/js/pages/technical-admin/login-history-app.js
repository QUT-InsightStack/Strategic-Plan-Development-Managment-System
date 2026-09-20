import { enforcePageAccess } from '../../access/access-guard.js';
import { getAccessSession } from '../../access/access-session.js';
import { listLoginHistory } from '../../api/login-history-api.js';
import { searchUsers } from '../../api/users-api.js';
import { AdministrativeAdminSidebar } from '../../components/AdministrativeAdminSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { TechnicalAdminSidebar } from '../../components/TechnicalAdminSidebar.js';

enforcePageAccess();

const { useEffect, useState } = React;

const initialFilters = { user_id: '', outcome: '', search: '', from: '', to: '' };

// Recorded against a failed attempt, and shown only to administrators. The
// person signing in always gets the same generic message.
const REASON_LABELS = {
    invalid_credentials: 'Wrong password',
    unknown_email: 'No such account',
    inactive_account: 'Account not active',
};

function formatTimestamp(value) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function LoginHistoryApp() {
    const accessSession = getAccessSession();
    const isAdministrativeAdmin = ['Administrative Admin', 'Administrative Administrator'].includes(accessSession?.roleName);
    const Sidebar = isAdministrativeAdmin ? AdministrativeAdminSidebar : TechnicalAdminSidebar;
    const [entries, setEntries] = useState([]);
    const [users, setUsers] = useState([]);
    const [filters, setFilters] = useState(initialFilters);
    const [appliedFilters, setAppliedFilters] = useState(initialFilters);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState({ type: '', message: '' });
    const [errors, setErrors] = useState({});

    async function loadHistory(page = 1, nextFilters = appliedFilters) {
        setLoading(true);
        setErrors({});
        try {
            const payload = await listLoginHistory({ ...nextFilters, page, per_page: 15 });
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
        loadHistory(1);

        // Populates the user filter. Failing here must not break the page —
        // the history itself is the point, so the filter just stays empty.
        searchUsers({ page: 1, per_page: 100, sort_by: 'name' })
            .then((payload) => setUsers(payload.data || []))
            .catch(() => setUsers([]));
    }, []);

    function applyFilters(event) {
        event.preventDefault();
        setAppliedFilters(filters);
        loadHistory(1, filters);
    }

    function clearFilters() {
        setFilters(initialFilters);
        setAppliedFilters(initialFilters);
        loadHistory(1, initialFilters);
    }

    return React.createElement(React.Fragment, null,
        React.createElement(Sidebar, { active: isAdministrativeAdmin ? 'System Logs' : undefined, onNotice: (message) => setNotice({ type: 'info', message }) }),
        React.createElement('main', { className: 'app-shell-main login-history-page' },
            React.createElement('div', { className: 'app-shell-container' },
                React.createElement(PageHeader, { section: isAdministrativeAdmin ? 'Administrative Monitoring' : 'Technical Administration', title: isAdministrativeAdmin ? 'System Logs' : 'Login History', subtitle: 'Every sign-in attempt across all accounts, successful or not.' }),

                notice.message ? React.createElement('div', { className: `ui-status ui-status--${notice.type}`, role: 'status', 'aria-live': 'polite' }, notice.message) : null,

                React.createElement('section', { className: 'ui-card', 'aria-labelledby': 'history-filter-title' },
                    React.createElement('div', { className: 'ui-section-header' },
                        React.createElement('div', { className: 'ui-section-header__copy' },
                            React.createElement('h2', { id: 'history-filter-title' }, 'Find sign-in attempts'),
                            React.createElement('p', null, 'Filter the audit trail by account, outcome, or date range.')
                        ),
                        React.createElement('i', { className: 'bi bi-funnel', 'aria-hidden': 'true' })
                    ),
                    React.createElement('div', { className: 'ui-card__body' },
                        React.createElement('form', { className: 'login-history-filters', onSubmit: applyFilters },
                            React.createElement('div', { className: 'ui-field login-history-filters__search' },
                                React.createElement('label', { className: 'ui-label', htmlFor: 'history-search' }, 'Email'),
                                React.createElement('input', {
                                    id: 'history-search',
                                    className: 'ui-input',
                                    value: filters.search,
                                    placeholder: 'Search the address used',
                                    onChange: (event) => setFilters((current) => ({ ...current, search: event.target.value })),
                                })
                            ),
                            React.createElement('div', { className: 'ui-field' },
                                React.createElement('label', { className: 'ui-label', htmlFor: 'history-user' }, 'User'),
                                React.createElement('select', {
                                    id: 'history-user',
                                    className: 'ui-select',
                                    value: filters.user_id,
                                    onChange: (event) => setFilters((current) => ({ ...current, user_id: event.target.value })),
                                },
                                    React.createElement('option', { value: '' }, 'All users'),
                                    users.map((user) => React.createElement('option', { key: user.user_id, value: user.user_id }, user.name || user.email))
                                )
                            ),
                            React.createElement('div', { className: 'ui-field' },
                                React.createElement('label', { className: 'ui-label', htmlFor: 'history-outcome' }, 'Outcome'),
                                React.createElement('select', {
                                    id: 'history-outcome',
                                    className: 'ui-select',
                                    value: filters.outcome,
                                    onChange: (event) => setFilters((current) => ({ ...current, outcome: event.target.value })),
                                },
                                    React.createElement('option', { value: '' }, 'All outcomes'),
                                    React.createElement('option', { value: 'success' }, 'Successful'),
                                    React.createElement('option', { value: 'failed' }, 'Failed')
                                )
                            ),
                            React.createElement('div', { className: `ui-field${errors.from ? ' is-invalid' : ''}` },
                                React.createElement('label', { className: 'ui-label', htmlFor: 'history-from' }, 'From'),
                                React.createElement('input', {
                                    id: 'history-from',
                                    className: 'ui-input',
                                    type: 'date',
                                    value: filters.from,
                                    'aria-invalid': errors.from ? 'true' : undefined,
                                    'aria-describedby': errors.from ? 'history-from-error' : undefined,
                                    onChange: (event) => setFilters((current) => ({ ...current, from: event.target.value })),
                                }),
                                errors.from ? React.createElement('p', { id: 'history-from-error', className: 'ui-error' }, errors.from[0]) : null
                            ),
                            React.createElement('div', { className: `ui-field${errors.to ? ' is-invalid' : ''}` },
                                React.createElement('label', { className: 'ui-label', htmlFor: 'history-to' }, 'To'),
                                React.createElement('input', {
                                    id: 'history-to',
                                    className: 'ui-input',
                                    type: 'date',
                                    value: filters.to,
                                    'aria-invalid': errors.to ? 'true' : undefined,
                                    'aria-describedby': errors.to ? 'history-to-error' : undefined,
                                    onChange: (event) => setFilters((current) => ({ ...current, to: event.target.value })),
                                }),
                                errors.to ? React.createElement('p', { id: 'history-to-error', className: 'ui-error' }, errors.to[0]) : null
                            ),
                            React.createElement('div', { className: 'login-history-filter-actions' },
                                React.createElement('button', { className: 'ui-button ui-button--primary', type: 'submit', disabled: loading }, React.createElement('i', { className: 'bi bi-search' }), 'Search'),
                                React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', disabled: loading, onClick: clearFilters }, 'Clear')
                            )
                        )
                    )
                ),

                React.createElement('section', { className: 'ui-card', 'aria-labelledby': 'history-list-title' },
                    React.createElement('div', { className: 'ui-section-header' },
                        React.createElement('div', { className: 'ui-section-header__copy' },
                            React.createElement('h2', { id: 'history-list-title' }, 'Sign-in Attempt Register'),
                            React.createElement('p', null, `${meta.total || 0} recorded attempt${meta.total === 1 ? '' : 's'}`)
                        ),
                        React.createElement('i', { className: 'bi bi-clock-history', 'aria-hidden': 'true' })
                    ),
                    React.createElement('div', { className: 'ui-card__body' },
                        loading
                            ? React.createElement('p', { className: 'ui-help' }, 'Loading login history…')
                            : entries.length === 0
                                ? React.createElement('p', { className: 'ui-help' }, 'No sign-in attempts match these filters.')
                                : React.createElement('div', { className: 'ui-table-wrap' },
                                    React.createElement('table', { className: 'ui-table login-history-table' },
                                        React.createElement('caption', { className: 'ui-visually-hidden' }, 'Sign-in attempts across all accounts'),
                                        React.createElement('thead', null,
                                            React.createElement('tr', null,
                                                React.createElement('th', { scope: 'col' }, 'When'),
                                                React.createElement('th', { scope: 'col' }, 'Account'),
                                                React.createElement('th', { scope: 'col' }, 'IP address'),
                                                React.createElement('th', { scope: 'col' }, 'Device'),
                                                React.createElement('th', { scope: 'col' }, 'Outcome')
                                            )
                                        ),
                                        React.createElement('tbody', null,
                                            entries.map((entry) => React.createElement('tr', { key: entry.login_history_id },
                                                React.createElement('td', null, formatTimestamp(entry.created_at)),
                                                React.createElement('td', null,
                                                    // An attempt on an address with no account has no user
                                                    // to name, which is exactly what makes it worth seeing.
                                                    React.createElement('strong', null, entry.user?.name || 'Unknown account'),
                                                    React.createElement('span', { className: 'login-history-email' }, entry.email)
                                                ),
                                                React.createElement('td', { className: 'login-history-ip' }, entry.ip_address || '—'),
                                                React.createElement('td', null,
                                                    entry.device_label || 'Unknown',
                                                    entry.user_agent ? React.createElement('span', { className: 'login-history-agent', title: entry.user_agent }, entry.user_agent) : null
                                                ),
                                                React.createElement('td', null,
                                                    React.createElement('span', { className: `ui-badge ui-badge--${entry.outcome === 'success' ? 'success' : 'danger'}` }, entry.outcome === 'success' ? 'Successful' : 'Failed'),
                                                    entry.outcome !== 'success' && entry.reason
                                                        ? React.createElement('span', { className: 'login-history-reason' }, REASON_LABELS[entry.reason] || entry.reason)
                                                        : null
                                                )
                                            ))
                                        )
                                    )
                                ),

                        meta.last_page > 1 ? React.createElement('div', { className: 'ui-pagination' },
                            React.createElement('span', null, `Page ${meta.current_page} of ${meta.last_page} · ${meta.total} attempts`),
                            React.createElement('div', { className: 'ui-pagination__actions' },
                                React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: loading || meta.current_page <= 1, onClick: () => loadHistory(meta.current_page - 1) }, React.createElement('i', { className: 'bi bi-chevron-left' }), 'Previous'),
                                React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: loading || meta.current_page >= meta.last_page, onClick: () => loadHistory(meta.current_page + 1) }, 'Next', React.createElement('i', { className: 'bi bi-chevron-right' }))
                            )
                        ) : null
                    )
                )
            )
        )
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(LoginHistoryApp));
