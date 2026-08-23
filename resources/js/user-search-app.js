import './resource-crud-config.js';
import { BrandLogo } from './brand-logo.js';

const { useEffect, useRef, useState } = React;

const rootElement = document.getElementById('root');
const crud = window.ResourceCrud;
const dashboardUrl = '/dashboard';
const profileUrl = '/profile';
const createUserUrl = '/create-user';
const resourceFormUrl = '/resource-form';
const userRolesUrl = '/user-roles';
const loginUrl = '/login';
const searchApiUrl = '/api/users/search';

// Delay before an in-progress query is sent, so typing does not fire a
// request per keystroke.
const SEARCH_DEBOUNCE_MS = 350;
const PER_PAGE = 15;

function Brand() {
    return React.createElement(
        'a',
        { className: 'brand', href: dashboardUrl, 'aria-label': 'Strategic planning Management System home' },
        React.createElement(BrandLogo),
        React.createElement('span', { className: 'brand-name' }, 'Strategic planning Management System')
    );
}

function Header({ onLogout }) {
    return React.createElement(
        'header',
        { className: 'app-header', 'aria-label': 'Application header' },
        React.createElement(Brand),
        React.createElement(
            'nav',
            { className: 'top-nav', 'aria-label': 'Primary navigation' },
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => window.location.href = dashboardUrl }, 'Dashboard'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => window.location.href = profileUrl }, 'Profile'),
            React.createElement('button', { className: 'nav-link logout-link', type: 'button', onClick: onLogout }, 'Logout')
        )
    );
}

function StatusBadge({ status }) {
    const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';

    return React.createElement('span', { className: `status-badge is-${status || 'unknown'}` }, label);
}

function SearchIcon() {
    return React.createElement(
        'svg',
        { viewBox: '0 0 24 24', 'aria-hidden': 'true', className: 'search-icon' },
        React.createElement('path', {
            d: 'M10 4a6 6 0 1 0 3.5 10.9l4.3 4.3 1.4-1.4-4.3-4.3A6 6 0 0 0 10 4Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
        })
    );
}

function ResultsTable({ users }) {
    return React.createElement(
        'div',
        { className: 'results-scroll' },
        React.createElement(
            'table',
            { className: 'results-table' },
            React.createElement(
                'thead',
                null,
                React.createElement(
                    'tr',
                    null,
                    React.createElement('th', null, 'Name'),
                    React.createElement('th', null, 'Email'),
                    React.createElement('th', null, 'Role'),
                    React.createElement('th', null, 'Unit / Office'),
                    React.createElement('th', null, 'Status'),
                    React.createElement('th', null, 'Actions')
                )
            ),
            React.createElement(
                'tbody',
                null,
                users.map((user) =>
                    React.createElement(
                        'tr',
                        { key: user.user_id },
                        React.createElement(
                            'td',
                            { 'data-label': 'Name' },
                            [user.first_name, user.last_name].filter(Boolean).join(' ') || '-'
                        ),
                        React.createElement('td', { 'data-label': 'Email' }, user.email || '-'),
                        React.createElement('td', { 'data-label': 'Role' }, user.role_name || '-'),
                        React.createElement(
                            'td',
                            { 'data-label': 'Unit / Office' },
                            [user.unit, user.office].filter(Boolean).join(' / ') || '-'
                        ),
                        React.createElement('td', { 'data-label': 'Status' }, React.createElement(StatusBadge, { status: user.status })),
                        React.createElement(
                            'td',
                            { 'data-label': 'Actions' },
                            React.createElement(
                                'div',
                                { className: 'row-actions' },
                                React.createElement(
                                    'a',
                                    { className: 'action-button secondary small', href: `${resourceFormUrl}?resource=users&id=${user.user_id}` },
                                    'Edit'
                                ),
                                React.createElement(
                                    'a',
                                    {
                                        className: 'action-button secondary small',
                                        // Carry the current search so returning
                                        // from the role page restores it.
                                        href: `${userRolesUrl}?id=${user.user_id}&return=${encodeURIComponent(window.location.search)}`,
                                    },
                                    'Assign Role'
                                )
                            )
                        )
                    )
                )
            )
        )
    );
}

function Pagination({ meta, onPage }) {
    if (!meta || meta.last_page <= 1) {
        return null;
    }

    return React.createElement(
        'div',
        { className: 'pagination' },
        React.createElement(
            'button',
            {
                className: 'action-button secondary small',
                type: 'button',
                disabled: meta.current_page <= 1,
                onClick: () => onPage(meta.current_page - 1),
            },
            'Previous'
        ),
        React.createElement(
            'span',
            { className: 'pagination-info' },
            `Page ${meta.current_page} of ${meta.last_page} (${meta.total} user${meta.total === 1 ? '' : 's'})`
        ),
        React.createElement(
            'button',
            {
                className: 'action-button secondary small',
                type: 'button',
                disabled: meta.current_page >= meta.last_page,
                onClick: () => onPage(meta.current_page + 1),
            },
            'Next'
        )
    );
}

function UserSearchApp() {
    const [term, setTerm] = useState('');
    const [roleId, setRoleId] = useState('');
    const [status, setStatus] = useState('');
    const [roles, setRoles] = useState([]);
    const [users, setUsers] = useState([]);
    const [meta, setMeta] = useState(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hasSearched, setHasSearched] = useState(false);

    // Identifies the most recent request, so a slow earlier response cannot
    // overwrite the results of a later one.
    const requestIdRef = useRef(0);
    // Skips the debounce on the very first render and on explicit paging.
    const isFirstRender = useRef(true);

    useEffect(() => {
        loadRoles();
    }, []);

    // Changing the criteria resets to page 1; changing the page does not
    // reset the criteria.
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            runSearch(1);
            return;
        }

        const timer = window.setTimeout(() => {
            setPage(1);
            runSearch(1);
        }, SEARCH_DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
    }, [term, roleId, status]);

    async function loadRoles() {
        try {
            const response = await crud.requestJson('/api/roles');
            const list = crud.extractData(response);
            setRoles(Array.isArray(list) ? list : []);
        } catch (loadError) {
            // Non-fatal: the free-text search still works without the filter.
            setRoles([]);
        }
    }

    function buildQuery(targetPage) {
        const params = new URLSearchParams();

        if (term.trim()) params.set('q', term.trim());
        if (roleId) params.set('role_id', roleId);
        if (status) params.set('status', status);
        params.set('per_page', String(PER_PAGE));
        params.set('page', String(targetPage));

        return params.toString();
    }

    async function runSearch(targetPage) {
        const requestId = ++requestIdRef.current;

        setLoading(true);
        setError('');

        try {
            const response = await crud.requestJson(`${searchApiUrl}?${buildQuery(targetPage)}`);

            // A newer search has since been issued; discard this response.
            if (requestId !== requestIdRef.current) {
                return;
            }

            setUsers(Array.isArray(response?.data) ? response.data : []);
            setMeta(response?.meta || null);
            setHasSearched(true);
        } catch (searchError) {
            if (requestId !== requestIdRef.current) {
                return;
            }

            setUsers([]);
            setMeta(null);
            setError(searchError.message || 'Unable to search users. Please try again.');
        } finally {
            if (requestId === requestIdRef.current) {
                setLoading(false);
            }
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        setPage(1);
        runSearch(1);
    }

    function handleClear() {
        setTerm('');
        setRoleId('');
        setStatus('');
        setPage(1);
        // The criteria effect will fire and reload the full list.
    }

    function handlePage(nextPage) {
        setPage(nextPage);
        runSearch(nextPage);
    }

    function handleLogout() {
        crud.requestJson('/api/logout', { method: 'POST' })
            .catch(() => null)
            .finally(() => {
                window.location.replace(loginUrl);
            });
    }

    const hasFilters = Boolean(term.trim() || roleId || status);

    return React.createElement(
        'div',
        { className: 'user-search-shell' },
        React.createElement(Header, { onLogout: handleLogout }),
        React.createElement(
            'main',
            { className: 'user-search-main' },
            React.createElement(
                'div',
                { className: 'page-inner' },
                React.createElement(
                    'nav',
                    { className: 'breadcrumb', 'aria-label': 'Breadcrumb' },
                    React.createElement('a', { href: dashboardUrl }, 'Dashboard'),
                    React.createElement('span', { 'aria-hidden': 'true' }, '/'),
                    React.createElement('span', null, 'Search Users')
                ),
                React.createElement(
                    'div',
                    { className: 'page-title-row' },
                    React.createElement(
                        'div',
                        { className: 'page-title' },
                        React.createElement('h1', null, 'Search Users'),
                        React.createElement('p', null, 'Find user accounts by name, email address or role.')
                    ),
                    React.createElement('a', { className: 'action-button primary', href: createUserUrl }, 'Create User')
                ),
                React.createElement(
                    'form',
                    { className: 'search-panel', role: 'search', onSubmit: handleSubmit },
                    React.createElement(
                        'div',
                        { className: 'search-field is-wide' },
                        React.createElement('label', { htmlFor: 'user-search' }, 'Search by name, email or role'),
                        React.createElement(
                            'div',
                            { className: 'search-input-wrap' },
                            React.createElement(SearchIcon),
                            React.createElement('input', {
                                id: 'user-search',
                                type: 'search',
                                value: term,
                                placeholder: 'e.g. Jane, jane@example.com, Administrator',
                                autoComplete: 'off',
                                onChange: (event) => setTerm(event.target.value),
                            })
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'search-field' },
                        React.createElement('label', { htmlFor: 'role-filter' }, 'Filter by role'),
                        React.createElement(
                            'select',
                            {
                                id: 'role-filter',
                                value: roleId,
                                onChange: (event) => setRoleId(event.target.value),
                            },
                            React.createElement('option', { value: '' }, 'All roles'),
                            roles.map((role) =>
                                React.createElement(
                                    'option',
                                    { key: role.role_id, value: String(role.role_id) },
                                    role.role_name
                                )
                            )
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'search-field' },
                        React.createElement('label', { htmlFor: 'status-filter' }, 'Filter by status'),
                        React.createElement(
                            'select',
                            {
                                id: 'status-filter',
                                value: status,
                                onChange: (event) => setStatus(event.target.value),
                            },
                            React.createElement('option', { value: '' }, 'All statuses'),
                            React.createElement('option', { value: 'active' }, 'Active'),
                            React.createElement('option', { value: 'inactive' }, 'Inactive'),
                            React.createElement('option', { value: 'suspended' }, 'Suspended')
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'search-actions' },
                        React.createElement('button', { className: 'action-button primary', type: 'submit' }, 'Search'),
                        React.createElement(
                            'button',
                            {
                                className: 'action-button secondary',
                                type: 'button',
                                onClick: handleClear,
                                disabled: !hasFilters,
                            },
                            'Clear'
                        )
                    )
                ),
                React.createElement(
                    'section',
                    { className: 'results-card', 'aria-live': 'polite', 'aria-busy': loading },
                    loading
                        ? React.createElement('p', { className: 'state-message' }, 'Searching users...')
                        : error
                          ? React.createElement(
                                'div',
                                { className: 'state-message is-error' },
                                React.createElement('p', null, error),
                                React.createElement(
                                    'button',
                                    { className: 'action-button secondary small', type: 'button', onClick: () => runSearch(page) },
                                    'Try again'
                                )
                            )
                          : users.length === 0
                            ? React.createElement(
                                  'div',
                                  { className: 'state-message is-empty' },
                                  React.createElement('h2', null, 'No users found'),
                                  React.createElement(
                                      'p',
                                      null,
                                      hasFilters
                                          ? 'No accounts match your search. Try a different name, email or role.'
                                          : 'There are no user accounts to display yet.'
                                  ),
                                  hasFilters
                                      ? React.createElement(
                                            'button',
                                            { className: 'action-button secondary small', type: 'button', onClick: handleClear },
                                            'Clear search'
                                        )
                                      : null
                              )
                            : React.createElement(
                                  React.Fragment,
                                  null,
                                  React.createElement(ResultsTable, { users }),
                                  React.createElement(Pagination, { meta, onPage: handlePage })
                              )
                ),
                hasSearched && !loading && !error && users.length > 0 && meta
                    ? React.createElement(
                          'p',
                          { className: 'results-summary' },
                          `Showing ${meta.from}-${meta.to} of ${meta.total} user${meta.total === 1 ? '' : 's'}.`
                      )
                    : null
            )
        )
    );
}

ReactDOM.createRoot(rootElement).render(React.createElement(UserSearchApp));
