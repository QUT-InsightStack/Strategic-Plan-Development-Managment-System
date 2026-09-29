import { TechnicalAdminSidebar } from '../../components/TechnicalAdminSidebar.js';
import { AppDialog } from '../../components/AppDialog.js';
import { PageHeader } from '../../components/PageHeader.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { PERMISSIONS } from '../../access/access-policy.js';
import { can, getAccessSession } from '../../access/access-session.js';
import { displayRoleName } from '../../access/role-labels.js';
import { apiRequest } from '../../api/api-client.js';
import { assignUserRole, listRoles, searchUsers } from '../../api/users-api.js';

enforcePageAccess();

const { useEffect, useState } = React;
const PAGE_SIZE = 10;

function PermissionSettings() {
    const [roles, setRoles] = useState([]);
    const [permissions, setPermissions] = useState([]);
    const [roleId, setRoleId] = useState('');
    const [selected, setSelected] = useState([]);
    const [status, setStatus] = useState({ message: '', type: 'info' });

    useEffect(() => {
        Promise.all([apiRequest('/api/roles'), apiRequest('/api/permissions')])
            .then(([roleResponse, permissionResponse]) => {
                setRoles(roleResponse.data || []);
                setPermissions(permissionResponse.data || []);
                if (roleResponse.data?.length) setRoleId(String(roleResponse.data[0].role_id));
            })
            .catch((error) => setStatus({ message: error.message, type: 'error' }));
    }, []);

    useEffect(() => {
        if (!roleId) return;
        apiRequest(`/api/roles/${roleId}/permissions`)
            .then((response) => setSelected((response.data || []).map((item) => Number(item.permission_id || item.permission?.permission_id))))
            .catch((error) => setStatus({ message: error.message, type: 'error' }));
    }, [roleId]);

    function togglePermission(permissionId) {
        setSelected((current) => current.includes(permissionId) ? current.filter((id) => id !== permissionId) : [...current, permissionId]);
    }

    async function save(event) {
        event.preventDefault();
        try {
            const response = await apiRequest(`/api/roles/${roleId}/permissions`, { method: 'PUT', body: JSON.stringify({ permission_ids: selected }) });
            setSelected((response.data || []).map((item) => Number(item.permission_id || item.permission?.permission_id)));
            setStatus({ message: 'Permissions saved to this role successfully.', type: 'success' });
        } catch (error) {
            setStatus({ message: error.message, type: 'error' });
        }
    }

    return React.createElement('section', { className: 'ui-card role-panel security-settings', 'aria-labelledby': 'permission-settings-title' },
        React.createElement('div', { className: 'role-panel__header' }, React.createElement('h2', { id: 'permission-settings-title' }, 'Role Permission Settings'), React.createElement('p', null, 'Select a role and assign the permissions it should receive.')),
        React.createElement('form', { className: 'role-panel__body permission-options', onSubmit: save },
            React.createElement('label', { className: 'permission-settings__role' }, React.createElement('span', null, 'Role'), React.createElement('select', { className: 'ui-select', value: roleId, onChange: (event) => setRoleId(event.target.value) }, roles.map((role) => React.createElement('option', { key: role.role_id, value: role.role_id }, displayRoleName(role.role_name))))),
            React.createElement('div', { className: 'permission-settings__list' }, permissions.map((permission) => React.createElement('label', { key: permission.permission_id, className: `permission-option${selected.includes(Number(permission.permission_id)) ? ' is-selected' : ''}` }, React.createElement('span', null, React.createElement('strong', null, permission.permission_name || permission.code), React.createElement('small', null, permission.code)), React.createElement('input', { type: 'checkbox', checked: selected.includes(Number(permission.permission_id)), onChange: () => togglePermission(Number(permission.permission_id)), 'aria-label': `Assign ${permission.permission_name || permission.code}` })))),
            status.message ? React.createElement('div', { className: `ui-status ui-status--${status.type}`, role: 'status' }, status.message) : null,
            React.createElement('button', { className: 'ui-button ui-button--primary', type: 'submit', disabled: !roleId }, React.createElement('i', { className: 'bi bi-check2-circle' }), 'Save Role Permissions')
        )
    );
}

function RoleManagementApp() {
    const session = getAccessSession();
    const canAssignProtectedRoles = can(PERMISSIONS.ROLES_ASSIGN_PROTECTED, session);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [draftRoleId, setDraftRoleId] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState({ message: '', type: 'info' });
    const [dialog, setDialog] = useState({ open: false, variant: 'success', title: '', message: '' });

    if (new URLSearchParams(window.location.search).get('section') === 'security') window.location.replace('/settings');
    const isPermissionSection = new URLSearchParams(window.location.search).get('section') === 'permissions';
    const selectedUser = users.find((user) => Number(user.user_id) === Number(selectedUserId));
    const currentRoleId = selectedUser?.role?.role_id ? String(selectedUser.role.role_id) : '';
    const selectedRole = roles.find((role) => String(role.role_id) === draftRoleId);
    const roleChanged = Boolean(selectedUser && draftRoleId && draftRoleId !== currentRoleId);
    useEffect(() => {
        let active = true;
        listRoles()
            .then((roleResponse) => {
                if (!active) return;
                setRoles(roleResponse.data || []);
            })
            .catch((error) => active && setNotice({ message: error.message, type: 'error' }));
        return () => { active = false; };
    }, []);

    useEffect(() => {
        let active = true;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const response = await searchUsers({ search: search.trim(), page, per_page: PAGE_SIZE, sort_by: 'name', sort_direction: 'asc' });
                if (!active) return;
                const results = response.data || [];
                setUsers(results);
                setMeta(response.meta || { current_page: page, last_page: 1, total: results.length });
                setSelectedUserId((current) => results.some((user) => Number(user.user_id) === Number(current)) ? current : (results[0]?.user_id ?? null));
                setDraftRoleId((current) => results.some((user) => Number(user.user_id) === Number(selectedUserId)) ? current : String(results[0]?.role?.role_id || ''));
                setNotice({ message: '', type: 'info' });
            } catch (error) {
                if (active) setNotice({ message: error.message, type: 'error' });
            } finally {
                if (active) setLoading(false);
            }
        }, 250);
        return () => { active = false; window.clearTimeout(timer); };
    }, [search, page]);

    useEffect(() => {
        if (selectedUser) setDraftRoleId(currentRoleId);
    }, [selectedUserId, currentRoleId]);

    function chooseUser(user) {
        setSelectedUserId(user.user_id);
        setDraftRoleId(String(user.role?.role_id || ''));
        setNotice({ message: '', type: 'info' });
    }

    function resetRole() {
        setDraftRoleId(currentRoleId);
        setNotice({ message: '', type: 'info' });
    }

    function requestSave() {
        if (!selectedUser || !selectedRole || !selectedRole.is_assignable) {
            setNotice({ message: 'Choose a role that is approved for assignment.', type: 'error' });
            return;
        }
        if (selectedRole.is_protected && !canAssignProtectedRoles) {
            setNotice({ message: 'You are not authorized to assign this protected role.', type: 'error' });
            return;
        }
        if (!roleChanged) return;
        setDialog({ open: true, variant: 'danger', title: 'Confirm role change', message: `Change ${selectedUser.name}'s role to ${displayRoleName(selectedRole.role_name)}? This change will take effect on their next authenticated request.` });
    }

    async function confirmSave() {
        const user = selectedUser;
        const role = selectedRole;
        setDialog((current) => ({ ...current, open: false }));
        try {
            const response = await assignUserRole(user.user_id, role.role_id);
            const updatedUser = response.data;
            setUsers((current) => current.map((item) => Number(item.user_id) === Number(updatedUser.user_id) ? updatedUser : item));
            setDraftRoleId(String(updatedUser.role?.role_id || role.role_id));
            setNotice({ message: `${updatedUser.name}'s role was updated successfully.`, type: 'success' });
        } catch (error) {
            setNotice({ message: error.message, type: 'error' });
        }
    }

    function closeDialog() { setDialog((current) => ({ ...current, open: false })); }

    const userList = loading
        ? React.createElement('p', { className: 'role-empty' }, 'Loading users…')
        : users.length
            ? React.createElement('div', { className: 'role-user-list' }, users.map((user) =>
                React.createElement('button', {
                    key: user.user_id,
                    type: 'button',
                    className: `role-user${Number(user.user_id) === Number(selectedUserId) ? ' active' : ''}`,
                    onClick: () => chooseUser(user),
                },
                React.createElement('span', { className: 'role-user__avatar' }, React.createElement('i', { className: 'bi bi-person-fill' })),
                React.createElement('span', null,
                    React.createElement('strong', null, user.name),
                    React.createElement('small', null, user.office || user.department || user.unit || 'No office/unit'),
                    React.createElement('small', null, user.email)
                ))
            ))
            : React.createElement('p', { className: 'role-empty' }, 'No users found.');

    return React.createElement(React.Fragment, null,
        React.createElement(TechnicalAdminSidebar, { onNotice: (message) => setNotice({ message, type: 'info' }) }),
        React.createElement('main', { className: 'app-shell-main role-page' }, React.createElement('div', { className: 'app-shell-container' },
            React.createElement(PageHeader, {
                className: 'role-page__header',
                section: 'Technical Administration',
                title: isPermissionSection ? 'Role Permission Settings' : 'Assign Roles and Permissions',
                subtitle: isPermissionSection ? 'Select a role and manage the permissions stored for that role.' : 'Select a user account, assign an approved role, and review the permissions inherited from that role.',
            }),
            notice.message ? React.createElement('div', { className: `ui-status ui-status--${notice.type} role-page__notice`, role: 'status' }, notice.message) : null,
            isPermissionSection ? React.createElement(PermissionSettings) : React.createElement(React.Fragment, null,
                React.createElement('div', { className: 'role-workspace' },
                    React.createElement('section', { className: 'ui-card role-panel role-panel--users', 'aria-labelledby': 'users-title' },
                        React.createElement('div', { className: 'role-panel__header' }, React.createElement('h2', { id: 'users-title' }, 'Users'), React.createElement('p', null, 'Live accounts from User Account Management.')),
                        React.createElement('div', { className: 'role-panel__body' },
                            React.createElement('div', { className: 'role-search' }, React.createElement('i', { className: 'bi bi-search' }), React.createElement('input', { className: 'ui-input', value: search, placeholder: 'Search users', 'aria-label': 'Search users', onChange: (event) => { setSearch(event.target.value); setPage(1); } })),
                            userList,
                            React.createElement('div', { className: 'role-user-pagination' }, React.createElement('span', null, `${meta.total || 0} user(s)`), React.createElement('button', { type: 'button', className: 'ui-button ui-button--secondary', disabled: loading || page <= 1, onClick: () => setPage((current) => Math.max(1, current - 1)) }, 'Previous'), React.createElement('span', null, `${meta.current_page || page} / ${meta.last_page || 1}`), React.createElement('button', { type: 'button', className: 'ui-button ui-button--secondary', disabled: loading || page >= (meta.last_page || 1), onClick: () => setPage((current) => current + 1) }, 'Next'))
                        )
                    ),
                    selectedUser ? React.createElement(React.Fragment, null,
                        React.createElement('section', { className: 'ui-card role-panel', 'aria-labelledby': 'roles-title' },
                            React.createElement('div', { className: 'role-panel__header' }, React.createElement('h2', { id: 'roles-title' }, 'Assigned Role'), React.createElement('p', null, `Current role assignment for ${selectedUser.name}.`)),
                            React.createElement('div', { className: 'role-panel__body role-options' }, roles.map((role) => {
                                const current = String(role.role_id) === currentRoleId;
                                const checked = String(role.role_id) === draftRoleId;
                                const protectedBlocked = role.is_protected && !canAssignProtectedRoles && !current;
                                const unavailable = !role.is_assignable && !current;
                                return React.createElement('label', { key: role.role_id, className: `role-option${checked ? ' is-selected' : ''}${unavailable || protectedBlocked ? ' is-disabled' : ''}` }, React.createElement('span', null, React.createElement('strong', null, displayRoleName(role.role_name)), React.createElement('small', null, role.description || 'No description provided.'), current && role.is_protected ? React.createElement('span', { className: 'role-protected' }, React.createElement('i', { className: 'bi bi-lock-fill' }), 'Current protected role') : !role.is_assignable ? React.createElement('small', { className: 'role-protected' }, 'Not approved for assignment') : protectedBlocked ? React.createElement('small', { className: 'role-protected' }, 'Protected role — additional permission required') : null), React.createElement('span', { className: 'role-option__meta' }, React.createElement('input', { className: 'role-check', type: 'radio', name: 'assigned-role', checked, disabled: unavailable || protectedBlocked, onChange: () => setDraftRoleId(String(role.role_id)), 'aria-label': `Assign ${displayRoleName(role.role_name)}` })));
                            }))
                        )
                    ) : React.createElement('section', { className: 'ui-card role-panel role-empty-state' }, loading ? 'Loading user account…' : 'Select a user to manage their role.')
                ),
                React.createElement('div', { className: 'role-page__actions' }, React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: resetRole, disabled: !roleChanged }, 'Reset'), React.createElement('button', { className: 'ui-button ui-button--primary', type: 'button', onClick: requestSave, disabled: !roleChanged || loading }, React.createElement('i', { className: 'bi bi-check2-circle' }), 'Save Changes'))
            )
        )),
        React.createElement(AppDialog, { open: dialog.open, variant: dialog.variant, title: dialog.title, message: dialog.message, confirmLabel: 'Confirm Changes', onConfirm: confirmSave, onCancel: closeDialog })
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(RoleManagementApp));
