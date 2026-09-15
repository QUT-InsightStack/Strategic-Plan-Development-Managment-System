import { TechnicalAdminSidebar } from '../components/TechnicalAdminSidebar.js';
import { AppDialog } from '../components/AppDialog.js';
import { PageHeader } from '../components/PageHeader.js';
import { demoPermissions, demoRoles, demoUsers } from '../data/role-management-demo-data.js';
import { enforcePageAccess } from '../access/access-guard.js';
import { apiRequest } from '../api/api-client.js';

enforcePageAccess();

const { useEffect, useMemo, useState } = React;

const actionPermissionIds = [7, 8, 9, 10, 11];
const contributorActionPermissionIds = [7, 8, 9, 10];
const fullActionRoleIds = [1, 2, 4, 6];
const contributorActionRoleIds = [3, 5];

function permissionsForRoles(permissionIds, roleIds) {
    const nonActionPermissionIds = permissionIds.filter((id) => !actionPermissionIds.includes(id));
    const allowedActionPermissionIds = roleIds.some((id) => fullActionRoleIds.includes(id))
        ? actionPermissionIds
        : roleIds.some((id) => contributorActionRoleIds.includes(id))
            ? contributorActionPermissionIds
            : [];

    return [...new Set([...nonActionPermissionIds, ...allowedActionPermissionIds])];
}

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
            React.createElement('label', { className: 'permission-settings__role' }, React.createElement('span', null, 'Role'), React.createElement('select', { className: 'ui-select', value: roleId, onChange: (event) => setRoleId(event.target.value) }, roles.map((role) => React.createElement('option', { key: role.role_id, value: role.role_id }, role.role_name)))),
            React.createElement('div', { className: 'permission-settings__list' }, permissions.map((permission) => React.createElement('label', { key: permission.permission_id, className: `permission-option${selected.includes(Number(permission.permission_id)) ? ' is-selected' : ''}` }, React.createElement('span', null, React.createElement('strong', null, permission.permission_name || permission.code), React.createElement('small', null, permission.code)), React.createElement('input', { type: 'checkbox', checked: selected.includes(Number(permission.permission_id)), onChange: () => togglePermission(Number(permission.permission_id)), 'aria-label': `Assign ${permission.permission_name || permission.code}` })))),
            status.message ? React.createElement('div', { className: `ui-status ui-status--${status.type}`, role: 'status' }, status.message) : null,
            React.createElement('button', { className: 'ui-button ui-button--primary', type: 'submit', disabled: !roleId }, React.createElement('i', { className: 'bi bi-check2-circle' }), 'Save Role Permissions')
        )
    );
}

function RoleManagementApp() {
    const [users, setUsers] = useState(demoUsers);
    const [selectedUserId, setSelectedUserId] = useState(demoUsers[0].id);
    const [draftRoleIds, setDraftRoleIds] = useState(demoUsers[0].roleIds);
    const [draftPermissionIds, setDraftPermissionIds] = useState(demoUsers[0].permissionIds);
    const [search, setSearch] = useState('');
    const [notice, setNotice] = useState('');
    const [dialog, setDialog] = useState({ open: false, variant: 'success', title: '', message: '' });
    // Settings moved to its own page. Preserve the previous link.
    if (new URLSearchParams(window.location.search).get('section') === 'security') {
        window.location.replace('/settings');
    }
    const isPermissionSection = new URLSearchParams(window.location.search).get('section') === 'permissions';

    const selectedUser = users.find((user) => user.id === selectedUserId);
    const filteredUsers = useMemo(() => users.filter((user) => `${user.name} ${user.email} ${user.department}`.toLowerCase().includes(search.toLowerCase())), [users, search]);

    function chooseUser(user) {
        setSelectedUserId(user.id);
        setDraftRoleIds([...user.roleIds]);
        setDraftPermissionIds(permissionsForRoles(user.permissionIds, user.roleIds));
        setNotice('');
    }

    function toggleRole(role) {
        const selected = draftRoleIds.includes(role.id);
        if (selected && role.protected) {
            setDialog({ open: true, variant: 'error', title: 'Protected role', message: `${role.name} is required and cannot be removed in this demonstration.` });
            return;
        }
        const nextRoleIds = selected ? draftRoleIds.filter((id) => id !== role.id) : [...draftRoleIds, role.id];
        setDraftRoleIds(nextRoleIds);
        setDraftPermissionIds((current) => permissionsForRoles(current, nextRoleIds));
    }

    function togglePermission(permissionId) {
        if (actionPermissionIds.includes(permissionId)) {
            setDialog({ open: true, variant: 'error', title: 'Role-controlled action', message: 'Create, Review, Update, Archive, and Delete are assigned by role and cannot be overridden for an individual user.' });
            return;
        }
        setDraftPermissionIds((current) => current.includes(permissionId) ? current.filter((id) => id !== permissionId) : [...current, permissionId]);
    }

    function requestSave() {
        if (draftRoleIds.length === 0) {
            setDialog({ open: true, variant: 'error', title: 'Role assignment required', message: 'Select at least one approved role before saving.' });
            return;
        }
        setDialog({ open: true, variant: 'danger', title: 'Confirm role and permission changes', message: `Apply the selected roles and permissions to ${selectedUser.name}?` });
    }

    function confirmSave() {
        setUsers((current) => current.map((user) => user.id === selectedUserId ? { ...user, roleIds: [...new Set(draftRoleIds)], permissionIds: [...new Set(draftPermissionIds)] } : user));
        setDialog({ open: true, variant: 'success', title: 'Roles assigned successfully', message: `${selectedUser.name}'s demonstration roles and permissions were updated on this page.` });
    }

    function closeDialog() { setDialog((current) => ({ ...current, open: false })); }

    return React.createElement(React.Fragment, null,
        React.createElement(TechnicalAdminSidebar, { onNotice: setNotice }),
        React.createElement('main', { className: 'app-shell-main role-page' }, React.createElement('div', { className: 'app-shell-container' },
            React.createElement(PageHeader, {
                className: 'role-page__header',
                section: 'Technical Administration',
                title: isPermissionSection ? 'Role Permission Settings' : 'Assign Roles and Permissions',
                subtitle: isPermissionSection ? 'Select a role and manage the permissions stored for that role.' : 'Select a user, assign approved roles, and control the permissions available to that user.',
                actions: isPermissionSection ? null : React.createElement('span', { className: 'role-demo-label' }, React.createElement('i', { className: 'bi bi-display' }), 'Frontend demonstration'),
            }),
            notice ? React.createElement('div', { className: 'ui-status ui-status--info role-page__notice', role: 'status' }, notice) : null,
            isPermissionSection ? React.createElement(PermissionSettings) : React.createElement('div', { className: 'role-workspace' },
                React.createElement('section', { className: 'ui-card role-panel role-panel--users', 'aria-labelledby': 'users-title' },
                    React.createElement('div', { className: 'role-panel__header' }, React.createElement('h2', { id: 'users-title' }, 'Users'), React.createElement('p', null, 'Choose the user whose access you want to manage.')),
                    React.createElement('div', { className: 'role-panel__body' },
                        React.createElement('div', { className: 'role-search' }, React.createElement('i', { className: 'bi bi-search' }), React.createElement('input', { className: 'ui-input', value: search, placeholder: 'Search users', 'aria-label': 'Search users', onChange: (event) => setSearch(event.target.value) })),
                        React.createElement('div', { className: 'role-user-list' }, filteredUsers.map((user) => React.createElement('button', { key: user.id, type: 'button', className: `role-user${user.id === selectedUserId ? ' active' : ''}`, onClick: () => chooseUser(user) }, React.createElement('span', { className: 'role-user__avatar' }, React.createElement('i', { className: 'bi bi-person-fill' })), React.createElement('span', null, React.createElement('strong', null, user.name), React.createElement('small', null, user.department), React.createElement('small', null, user.email)))))
                    )
                ),
                React.createElement('section', { className: 'ui-card role-panel', 'aria-labelledby': 'roles-title' },
                    React.createElement('div', { className: 'role-panel__header' }, React.createElement('h2', { id: 'roles-title' }, 'Approved Roles'), React.createElement('p', null, `Current role assignments for ${selectedUser.name}.`)),
                    React.createElement('div', { className: 'role-panel__body role-options' }, demoRoles.map((role) => {
                        const selected = draftRoleIds.includes(role.id);
                        return React.createElement('label', { key: role.id, className: `role-option${selected ? ' is-selected' : ''}` }, React.createElement('span', null, React.createElement('strong', null, role.name), React.createElement('small', null, role.description), selected && role.protected ? React.createElement('span', { className: 'role-protected' }, React.createElement('i', { className: 'bi bi-lock-fill' }), 'Required role — cannot be removed') : null), React.createElement('span', { className: 'role-option__meta' }, React.createElement('input', { className: 'role-check', type: 'checkbox', checked: selected, onChange: () => toggleRole(role), 'aria-label': `${selected ? 'Remove' : 'Assign'} ${role.name}` })));
                    }))
                ),
                React.createElement('section', { className: 'ui-card role-panel', 'aria-labelledby': 'permissions-title' },
                    React.createElement('div', { className: 'role-panel__header' }, React.createElement('h2', { id: 'permissions-title' }, 'User Permissions'), React.createElement('p', null, 'Demonstration controls for this user’s effective permissions.')),
                    React.createElement('div', { className: 'role-panel__body permission-options' }, demoPermissions.map((permission) => {
                        const selected = draftPermissionIds.includes(permission.id);
                        const controlledByRole = actionPermissionIds.includes(permission.id);
                        return React.createElement('div', { key: permission.id, className: `permission-option${selected ? ' is-selected' : ''}` }, React.createElement('span', null, React.createElement('strong', null, permission.name), React.createElement('small', null, controlledByRole ? `${permission.description} Assigned automatically by role.` : permission.description)), React.createElement('label', { className: 'permission-switch' }, React.createElement('input', { type: 'checkbox', checked: selected, disabled: controlledByRole, onChange: () => togglePermission(permission.id), 'aria-label': `${permission.name} ${selected ? 'allowed' : 'not allowed'} by assigned role` }), React.createElement('span', null)));
                    }))
                )
            ),
            isPermissionSection ? null : React.createElement('div', { className: 'role-page__actions' }, React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: () => chooseUser(selectedUser) }, 'Reset'), React.createElement('button', { className: 'ui-button ui-button--primary', type: 'button', onClick: requestSave }, React.createElement('i', { className: 'bi bi-check2-circle' }), 'Save Changes'))
        )),
        React.createElement(AppDialog, { open: dialog.open, variant: dialog.variant, title: dialog.title, message: dialog.message, confirmLabel: dialog.variant === 'danger' ? 'Confirm Changes' : 'Continue', onConfirm: dialog.variant === 'danger' ? confirmSave : closeDialog, onCancel: closeDialog })
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(RoleManagementApp));
