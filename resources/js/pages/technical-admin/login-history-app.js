import { mountProtectedPage } from '../../access/mount-protected-page.js';
import { getAccessSession } from '../../access/access-session.js';
import { listLoginHistory } from '../../api/login-history-api.js';
import { searchUsers } from '../../api/users-api.js';
import { AdministrativeAdminSidebar } from '../../components/AdministrativeAdminSidebar.js';
import { FilterBar, FilterDate, FilterSearch, FilterSelect } from '../../components/FilterBar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { TechnicalAdminSidebar } from '../../components/TechnicalAdminSidebar.js';


const { useEffect, useState } = React;

const initialFilters = { user_id: '', status: '', search: '', date_from: '', date_to: '' };

// Recorded against a failed attempt, and shown only to administrators. The
// person signing in always gets the same generic message.
const REASON_LABELS = {
    invalid_credentials: 'Invalid credentials',
    unknown_email: 'No such account',
    inactive_account: 'Account not active',
    account_locked: 'Account locked',
    rate_limited: 'Too many attempts',
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

                React.createElement(FilterBar, { label: 'Filter sign-in attempts', busy: loading, onSubmit: applyFilters, onClear: clearFilters },
                    React.createElement(FilterSearch, { id: 'history-search', label: 'Email', value: filters.search, placeholder: 'Search the address used', onChange: (search) => setFilters((current) => ({ ...current, search })) }),
                    React.createElement(FilterSelect, { id: 'history-user', label: 'User', value: filters.user_id, allLabel: 'All users', options: users.map((user) => [user.user_id, user.name || user.email]), onChange: (user_id) => setFilters((current) => ({ ...current, user_id })) }),
                    React.createElement(FilterSelect, { id: 'history-outcome', label: 'Outcome', value: filters.status, allLabel: 'All outcomes', options: [['success', 'Successful'], ['failed', 'Failed']], onChange: (status) => setFilters((current) => ({ ...current, status })) }),
                    React.createElement(FilterDate, { id: 'history-from', label: 'From', value: filters.date_from, error: errors.date_from && errors.date_from[0], onChange: (date_from) => setFilters((current) => ({ ...current, date_from })) }),
                    React.createElement(FilterDate, { id: 'history-to', label: 'To', value: filters.date_to, error: errors.date_to && errors.date_to[0], onChange: (date_to) => setFilters((current) => ({ ...current, date_to })) })
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
                                                React.createElement('td', null, formatTimestamp(entry.attempted_at)),
                                                React.createElement('td', null,
                                                    // An attempt on an address with no account has no user
                                                    // to name, which is exactly what makes it worth seeing.
                                                    React.createElement('strong', null, entry.user_name || entry.user?.name || 'Unknown account'),
                                                    React.createElement('span', { className: 'login-history-email' }, entry.email)
                                                ),
                                                React.createElement('td', { className: 'login-history-ip' }, entry.ip_address || '—'),
                                                React.createElement('td', null,
                                                    entry.user_agent ? React.createElement('span', { className: 'login-history-agent', title: entry.user_agent }, entry.user_agent) : 'Unknown'
                                                ),
                                                React.createElement('td', null,
                                                    React.createElement('span', { className: `ui-badge ui-badge--${entry.status === 'success' ? 'success' : 'danger'}` }, entry.status === 'success' ? 'Successful' : 'Failed'),
                                                    entry.status !== 'success' && entry.failure_reason
                                                        ? React.createElement('span', { className: 'login-history-reason' }, REASON_LABELS[entry.failure_reason] || entry.failure_reason)
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

mountProtectedPage(document.getElementById('root'), () => React.createElement(LoginHistoryApp));
