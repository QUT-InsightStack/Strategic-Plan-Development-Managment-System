import './resource-crud-config.js';
import { BrandLogo } from './brand-logo.js';

const { useEffect, useState } = React;

const rootElement = document.getElementById('root');
const crud = window.ResourceCrud;
const dashboardUrl = '/dashboard';
const profileUrl = '/profile';
const userSearchUrl = '/user-search';
const loginUrl = '/login';

const params = new URLSearchParams(window.location.search);
const userId = params.get('id') || '';

/**
 * Where Cancel and the breadcrumb return to.
 *
 * The search page passes its own query string as `return` so an administrator
 * comes back to the results they were looking at rather than a blank search.
 *
 * Only the query string is taken, never a full URL: accepting an arbitrary
 * destination here would make this an open redirect.
 */
const returnUrl = (() => {
    const raw = params.get('return');

    if (!raw) {
        return userSearchUrl;
    }

    // A query string only. Reject anything that could change the host or path.
    if (/^\?[^\s]*$/.test(raw) && !raw.includes('//')) {
        return `${userSearchUrl}${raw}`;
    }

    return userSearchUrl;
})();

// Mirrors Role::PRIVILEGED_ROLES. Used only to warn before granting elevated
// access; the authoritative check is server-side.
const PRIVILEGED_ROLES = ['Administrator'];

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

function RoleCard({ role, selected, disabled, onSelect }) {
    const isPrivileged = PRIVILEGED_ROLES.includes(role.role_name);

    return React.createElement(
        'label',
        { className: `role-option${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}` },
        React.createElement('input', {
            type: 'radio',
            name: 'role',
            value: String(role.role_id),
            checked: selected,
            disabled,
            onChange: () => onSelect(String(role.role_id)),
        }),
        React.createElement(
            'span',
            { className: 'role-option-body' },
            React.createElement(
                'span',
                { className: 'role-option-name' },
                role.role_name,
                isPrivileged ? React.createElement('span', { className: 'role-badge-privileged' }, 'Elevated access') : null
            ),
            role.description
                ? React.createElement('span', { className: 'role-option-description' }, role.description)
                : null
        )
    );
}

/**
 * Confirmation shown before a role change is saved, so the administrator sees
 * exactly what is about to change rather than a generic "are you sure".
 */
function ConfirmDialog({ userName, fromRole, toRole, saving, onConfirm, onCancel }) {
    const grantsPrivilege = toRole && PRIVILEGED_ROLES.includes(toRole);
    const removesRole = !toRole;

    return React.createElement(
        'div',
        { className: 'dialog-backdrop', role: 'presentation', onClick: (event) => { if (event.target === event.currentTarget && !saving) onCancel(); } },
        React.createElement(
            'div',
            { className: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'confirm-title' },
            React.createElement('h2', { id: 'confirm-title' }, 'Confirm role change'),
            React.createElement(
                'p',
                { className: 'dialog-body' },
                'You are changing the role for ',
                React.createElement('strong', null, userName),
                '.'
            ),
            React.createElement(
                'div',
                { className: 'dialog-change' },
                React.createElement('span', { className: 'dialog-role from' }, fromRole || 'No role'),
                React.createElement('span', { className: 'dialog-arrow', 'aria-hidden': 'true' }, '→'),
                React.createElement('span', { className: 'dialog-role to' }, toRole || 'No role')
            ),
            grantsPrivilege
                ? React.createElement(
                      'p',
                      { className: 'dialog-warning' },
                      'This grants full administrative access, including managing users and roles.'
                  )
                : null,
            removesRole
                ? React.createElement(
                      'p',
                      { className: 'dialog-warning' },
                      'Removing the role leaves this account with no permissions until a new role is assigned.'
                  )
                : null,
            React.createElement(
                'p',
                { className: 'dialog-note' },
                'The change applies the next time this user signs in, or when their session refreshes.'
            ),
            React.createElement(
                'div',
                { className: 'dialog-actions' },
                React.createElement(
                    'button',
                    { className: 'action-button secondary', type: 'button', onClick: onCancel, disabled: saving },
                    'Cancel'
                ),
                React.createElement(
                    'button',
                    { className: 'action-button primary', type: 'button', onClick: onConfirm, disabled: saving },
                    saving ? 'Saving...' : 'Confirm change'
                )
            )
        )
    );
}

function UserRolesApp() {
    const [user, setUser] = useState(null);
    const [roles, setRoles] = useState([]);
    const [selectedRoleId, setSelectedRoleId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [status, setStatus] = useState({ message: '', type: 'info' });

    useEffect(() => {
        loadData();
    }, []);

    function setStatusMessage(message, type = 'info') {
        setStatus({ message, type });
    }

    async function loadData() {
        if (!userId) {
            setStatusMessage('No user selected. Choose a user from the search page.', 'error');
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const [userResponse, rolesResponse] = await Promise.all([
                crud.requestJson(`/api/users/${userId}`),
                crud.requestJson('/api/roles'),
            ]);

            const loadedUser = crud.extractData(userResponse);
            const loadedRoles = crud.extractData(rolesResponse);

            setUser(loadedUser);
            setRoles(Array.isArray(loadedRoles) ? loadedRoles : []);
            setSelectedRoleId(loadedUser?.role_id ? String(loadedUser.role_id) : '');
            setStatusMessage('', 'info');
        } catch (error) {
            setStatusMessage(error.message || 'Unable to load this user.', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handleConfirm() {
        setSaving(true);

        try {
            const response = await crud.requestJson(`/api/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role_id: selectedRoleId ? Number(selectedRoleId) : null }),
            });

            setConfirming(false);
            setStatusMessage(response?.message || 'Role updated successfully.', 'success');

            // Refresh so the displayed current role reflects what was saved.
            const refreshed = crud.extractData(await crud.requestJson(`/api/users/${userId}`));
            setUser(refreshed);
        } catch (error) {
            setConfirming(false);

            // Rule violations arrive as a 422 keyed on role_id.
            const fieldError = error.body?.errors?.role_id;
            setStatusMessage(
                Array.isArray(fieldError) ? fieldError[0] : fieldError || error.message || 'Unable to update the role.',
                'error'
            );
        } finally {
            setSaving(false);
        }
    }

    function handleLogout() {
        crud.requestJson('/api/logout', { method: 'POST' })
            .catch(() => null)
            .finally(() => window.location.replace(loginUrl));
    }

    const currentRoleId = user?.role_id ? String(user.role_id) : '';
    const hasChange = selectedRoleId !== currentRoleId;
    const currentRoleName = roles.find((role) => String(role.role_id) === currentRoleId)?.role_name || null;
    const selectedRoleName = roles.find((role) => String(role.role_id) === selectedRoleId)?.role_name || null;
    const userName = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email : '';

    return React.createElement(
        'div',
        { className: 'user-roles-shell' },
        React.createElement(Header, { onLogout: handleLogout }),
        React.createElement(
            'main',
            { className: 'user-roles-main' },
            React.createElement(
                'div',
                { className: 'page-inner narrow' },
                React.createElement(
                    'nav',
                    { className: 'breadcrumb', 'aria-label': 'Breadcrumb' },
                    React.createElement('a', { href: dashboardUrl }, 'Dashboard'),
                    React.createElement('span', { 'aria-hidden': 'true' }, '/'),
                    React.createElement('a', { href: returnUrl }, 'Users'),
                    React.createElement('span', { 'aria-hidden': 'true' }, '/'),
                    React.createElement('span', null, 'Assign Role')
                ),
                React.createElement(
                    'div',
                    { className: 'page-title' },
                    React.createElement('h1', null, 'Assign User Role'),
                    React.createElement('p', null, 'Control what this user can access by assigning an approved role.')
                ),
                loading
                    ? React.createElement('p', { className: 'state-message' }, 'Loading user...')
                    : !user
                      ? React.createElement(
                            'div',
                            { className: 'results-card' },
                            React.createElement(
                                'div',
                                { className: 'state-message is-error' },
                                React.createElement('p', null, status.message || 'User not found.'),
                                React.createElement('a', { className: 'action-button secondary small', href: returnUrl }, 'Back to users')
                            )
                        )
                      : React.createElement(
                            React.Fragment,
                            null,
                            React.createElement(
                                'section',
                                { className: 'user-summary-card' },
                                React.createElement(
                                    'div',
                                    null,
                                    React.createElement('h2', null, userName),
                                    React.createElement('p', { className: 'user-summary-email' }, user.email)
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'user-summary-role' },
                                    React.createElement('span', { className: 'user-summary-label' }, 'Current role'),
                                    React.createElement(
                                        'span',
                                        { className: 'user-summary-value' },
                                        currentRoleName || 'No role assigned'
                                    )
                                )
                            ),
                            React.createElement(
                                'section',
                                { className: 'roles-card' },
                                React.createElement('h2', null, 'Available roles'),
                                React.createElement(
                                    'p',
                                    { className: 'roles-note' },
                                    'Each user holds one role. Selecting a different role replaces the current one.'
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'role-options', role: 'radiogroup', 'aria-label': 'Available roles' },
                                    roles.map((role) =>
                                        React.createElement(RoleCard, {
                                            key: role.role_id,
                                            role,
                                            selected: selectedRoleId === String(role.role_id),
                                            disabled: saving,
                                            onSelect: setSelectedRoleId,
                                        })
                                    ),
                                    React.createElement(
                                        'label',
                                        { className: `role-option is-remove${selectedRoleId === '' ? ' is-selected' : ''}` },
                                        React.createElement('input', {
                                            type: 'radio',
                                            name: 'role',
                                            value: '',
                                            checked: selectedRoleId === '',
                                            disabled: saving,
                                            onChange: () => setSelectedRoleId(''),
                                        }),
                                        React.createElement(
                                            'span',
                                            { className: 'role-option-body' },
                                            React.createElement('span', { className: 'role-option-name' }, 'No role'),
                                            React.createElement(
                                                'span',
                                                { className: 'role-option-description' },
                                                'Removes all access until a role is assigned.'
                                            )
                                        )
                                    )
                                ),
                                React.createElement(
                                    'div',
                                    { className: 'roles-actions' },
                                    React.createElement('a', { className: 'action-button secondary', href: returnUrl }, 'Cancel'),
                                    React.createElement(
                                        'button',
                                        {
                                            className: 'action-button primary',
                                            type: 'button',
                                            disabled: !hasChange || saving,
                                            onClick: () => setConfirming(true),
                                        },
                                        'Save role'
                                    )
                                ),
                                status.message
                                    ? React.createElement(
                                          'p',
                                          { className: `form-status is-${status.type}`, role: 'status', 'aria-live': 'polite' },
                                          status.message
                                      )
                                    : null
                            )
                        ),
                confirming
                    ? React.createElement(ConfirmDialog, {
                          userName,
                          fromRole: currentRoleName,
                          toRole: selectedRoleName,
                          saving,
                          onConfirm: handleConfirm,
                          onCancel: () => setConfirming(false),
                      })
                    : null
            )
        )
    );
}

ReactDOM.createRoot(rootElement).render(React.createElement(UserRolesApp));
