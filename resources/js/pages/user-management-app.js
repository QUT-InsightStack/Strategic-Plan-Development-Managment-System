import { enforcePageAccess } from '../access/access-guard.js';
import { PERMISSIONS } from '../access/access-policy.js';
import { can, getAccessSession } from '../access/access-session.js';
import { createUser, listRoles, searchUsers, updateUser, updateUserStatus } from '../api/users-api.js';
import { AppDialog } from '../components/AppDialog.js';
import { TechnicalAdminSidebar } from '../components/TechnicalAdminSidebar.js';
import { useDialogBehaviour } from '../components/use-dialog-behaviour.js';

enforcePageAccess();

const { useEffect, useState } = React;
const initialFilters = { search: '', role_id: '', status: '' };
const initialAccount = { first_name: '', last_name: '', email: '', password: '', office: '', role_id: '', status: 'active' };

// Fields an administrator may change here. Role and account status are
// deliberately absent: each has its own endpoint that applies safeguards this
// form does not, so they are shown read-only below.
const initialEdit = {
    first_name: '',
    last_name: '',
    email: '',
    mobile: '',
    address: '',
    office: '',
    department: '',
    unit: '',
    position: '',
    date_of_birth: '',
    gender: '',
};

// Fields the server treats as nullable but which reject an empty string:
// a blank date is no date, not a date of "".
const NULLABLE_EDIT_FIELDS = ['date_of_birth', 'gender'];

// Codes are stored; these labels belong to the interface, so the wording can
// change without a migration. Must stay in step with
// App\Validation\UserValidationRules::GENDERS.
const GENDER_OPTIONS = [
    ['', 'Not specified'],
    ['female', 'Female'],
    ['male', 'Male'],
    ['non_binary', 'Non-binary'],
    ['prefer_not_to_say', 'Prefer not to say'],
];

// [name, label, input type, required, maxLength] — the lengths match the
// server's rules in UpdateUserRequest, so the field stops accepting input at
// the same point the API would reject it. maxLength is ignored for types
// that do not take free text.
const EDIT_FIELDS = [
    ['first_name', 'First name', 'text', true, 255],
    ['last_name', 'Last name', 'text', false, 255],
    ['email', 'Email', 'email', true, 255],
    ['mobile', 'Mobile', 'tel', false, 20],
    ['date_of_birth', 'Date of birth', 'date', false, undefined],
    ['address', 'Address', 'text', false, 255],
    ['office', 'Office / Agency', 'text', false, 255],
    ['department', 'Department', 'text', false, 255],
    ['unit', 'Unit', 'text', false, 255],
    ['position', 'Position', 'text', false, 255],
];

// The server rejects a date in the future, so the picker will not offer one.
function today() {
    return new Date().toISOString().slice(0, 10);
}

function editValuesFrom(user) {
    return {
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        mobile: user.mobile || '',
        address: user.address || '',
        office: user.office || '',
        department: user.department || '',
        unit: user.unit || '',
        position: user.position || '',
        // Already YYYY-MM-DD from UserResource, which is what a date input
        // expects; anything else would silently render as blank.
        date_of_birth: user.date_of_birth || '',
        gender: user.gender || '',
    };
}

function statusDetails(status) {
    if (status === 'active') return { label: 'Active', badge: 'success' };
    if (status === 'suspended') return { label: 'Suspended', badge: 'warning' };
    return { label: 'Disabled', badge: 'neutral' };
}

function UserManagementApp() {
    const accessSession = getAccessSession();
    const canUpdateUsers = can(PERMISSIONS.USERS_UPDATE, accessSession) || can(PERMISSIONS.USERS_MANAGE, accessSession);
    const canCreateUsers = can(PERMISSIONS.USERS_CREATE, accessSession) && can(PERMISSIONS.USERS_ASSIGN_ROLES, accessSession);
    const canAssignProtectedRoles = can(PERMISSIONS.ROLES_ASSIGN_PROTECTED, accessSession);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [filters, setFilters] = useState(initialFilters);
    const [appliedFilters, setAppliedFilters] = useState(initialFilters);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState({ type: '', message: '' });
    const [dialog, setDialog] = useState({ open: false, variant: 'danger', user: null, targetStatus: '' });
    const [createOpen, setCreateOpen] = useState(false);
    const [account, setAccount] = useState(initialAccount);
    const [accountErrors, setAccountErrors] = useState({});
    const [editOpen, setEditOpen] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [editForm, setEditForm] = useState(initialEdit);
    const [editOriginal, setEditOriginal] = useState(initialEdit);
    const [editErrors, setEditErrors] = useState({});
    // Failures that belong to the request rather than a single field — a 403
    // on a protected account, or a 404. These must be shown inside the dialog:
    // the page-level notice renders behind the overlay, where the
    // administrator cannot see it.
    const [editError, setEditError] = useState('');

    const editDirty = Object.keys(editForm).some(
        (field) => editForm[field] !== editOriginal[field]
    );

    const editDialogRef = useDialogBehaviour(editOpen && Boolean(editUser), closeEditDialog);
    const createDialogRef = useDialogBehaviour(createOpen, closeCreateDialog);

    // Warn before a browser-level navigation loses unsaved edits. The dialog's
    // own Cancel and close buttons confirm separately, since those do not
    // trigger beforeunload.
    useEffect(() => {
        if (!editOpen || !editDirty) return undefined;

        function warn(event) {
            event.preventDefault();
            event.returnValue = '';
        }

        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [editOpen, editDirty]);

    async function loadUsers(page = 1, nextFilters = appliedFilters) {
        setLoading(true);
        setNotice({ type: '', message: '' });
        try {
            const payload = await searchUsers({ ...nextFilters, page, per_page: 10, sort_by: 'name' });
            setUsers(payload.data || []);
            setMeta(payload.meta || { current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
        } catch (error) {
            setNotice({ type: 'error', message: error.message });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        Promise.all([listRoles(), searchUsers({ page: 1, per_page: 10, sort_by: 'name' })])
            .then(([rolePayload, userPayload]) => {
                setRoles(rolePayload.data || []);
                setUsers(userPayload.data || []);
                setMeta(userPayload.meta || { current_page: 1, last_page: 1, total: 0, from: 0, to: 0 });
            })
            .catch((error) => setNotice({ type: 'error', message: error.message }))
            .finally(() => setLoading(false));
    }, []);

    function applyFilters(event) {
        event.preventDefault();
        setAppliedFilters(filters);
        loadUsers(1, filters);
    }

    function clearFilters() {
        setFilters(initialFilters);
        setAppliedFilters(initialFilters);
        loadUsers(1, initialFilters);
    }

    function restrictionFor(user) {
        if (user.status !== 'active') return '';

        if (Number(user.user_id) === Number(accessSession?.userId)) {
            return 'You cannot disable the account you are currently signed in with.';
        }

        const role = roles.find((item) => Number(item.role_id) === Number(user.role?.role_id));
        if (role?.is_protected) {
            return `${role.role_name} is a protected role. Change its protection or role assignment before disabling this account.`;
        }

        return '';
    }

    function requestStatusChange(user) {
        const targetStatus = user.status === 'active' ? 'inactive' : 'active';
        setDialog({ open: true, variant: 'danger', user, targetStatus });
    }

    function closeDialog() {
        setDialog((current) => ({ ...current, open: false }));
    }

    async function confirmStatusChange() {
        const user = dialog.user;
        const targetStatus = dialog.targetStatus;
        closeDialog();
        setLoading(true);
        try {
            await updateUserStatus(user.user_id, targetStatus);
            setUsers((current) => current.map((item) => item.user_id === user.user_id ? { ...item, status: targetStatus } : item));
            setNotice({
                type: 'success',
                message: `${user.name}'s account was ${targetStatus === 'active' ? 'enabled' : 'disabled'} successfully.`,
            });
        } catch (error) {
            setNotice({ type: 'error', message: error.errors?.status?.[0] || error.message });
        } finally {
            setLoading(false);
        }
    }

    function closeCreateDialog() {
        if (loading) return;
        setCreateOpen(false);
        setAccount(initialAccount);
        setAccountErrors({});
    }

    function openEditDialog(user) {
        const values = editValuesFrom(user);
        setNotice({ type: '', message: '' });
        setEditErrors({});
        setEditError('');
        setEditUser(user);
        setEditForm(values);
        setEditOriginal(values);
        setEditOpen(true);
    }

    function closeEditDialog() {
        if (loading) return;

        if (editDirty && !window.confirm('Discard your unsaved changes to this account?')) {
            return;
        }

        setEditOpen(false);
        setEditUser(null);
        setEditForm(initialEdit);
        setEditOriginal(initialEdit);
        setEditErrors({});
        setEditError('');
    }

    async function submitEdit(event) {
        event.preventDefault();

        // Send only what changed, so untouched fields are left alone by the
        // server's `sometimes` rules.
        const payload = {};
        Object.keys(editForm).forEach((field) => {
            if (editForm[field] === editOriginal[field]) {
                return;
            }

            const value = editForm[field];

            // Clearing one of these means "no value", so it has to go as
            // null. An empty string would fail the date rule rather than
            // emptying the field.
            payload[field] = NULLABLE_EDIT_FIELDS.includes(field) && value === ''
                ? null
                : value;
        });

        if (Object.keys(payload).length === 0) {
            setNotice({ type: 'info', message: 'No changes were made.' });
            setEditOpen(false);
            return;
        }

        setLoading(true);
        setEditErrors({});
        setEditError('');
        try {
            await updateUser(editUser.user_id, payload);
            setEditOpen(false);
            setEditUser(null);
            setEditForm(initialEdit);
            setEditOriginal(initialEdit);
            await loadUsers(meta.current_page);
            setNotice({
                type: 'success',
                message: `${`${payload.first_name ?? editOriginal.first_name} ${payload.last_name ?? editOriginal.last_name}`.trim()} was updated successfully.`,
            });
        } catch (error) {
            // The dialog stays open on failure so the entered values are not
            // lost, which means the message has to be shown inside it.
            setEditErrors(error.errors || {});
            setEditError(
                error.errors
                    ? 'Some details could not be saved. Check the fields marked below.'
                    : error.message || 'This account could not be updated.'
            );
        } finally {
            setLoading(false);
        }
    }

    async function submitAccount(event) {
        event.preventDefault();
        setLoading(true);
        setAccountErrors({});
        try {
            await createUser({
                ...account,
                role_id: Number(account.role_id),
            });
            setCreateOpen(false);
            setAccount(initialAccount);
            await loadUsers(1);
            setNotice({ type: 'success', message: `${account.first_name} ${account.last_name}`.trim() + ' was created successfully.' });
        } catch (error) {
            setAccountErrors(error.errors || {});
            setNotice({ type: 'error', message: error.message });
        } finally {
            setLoading(false);
        }
    }

    const selectedAction = dialog.targetStatus === 'active' ? 'Enable' : 'Disable';

    return React.createElement(React.Fragment, null,
        React.createElement(TechnicalAdminSidebar, { onNotice: (message) => setNotice({ type: 'info', message }) }),
        React.createElement('main', { className: 'app-shell-main user-page' },
            React.createElement('div', { className: 'app-shell-container' },
                React.createElement('header', { className: 'app-page-header user-page__header' },
                    React.createElement('div', null,
                        React.createElement('h1', { className: 'ui-page-title' }, 'User Management'),
                        React.createElement('p', { className: 'ui-page-subtitle' }, 'Review account access and enable or disable user accounts.')
                    ),
                    canCreateUsers ? React.createElement('button', { className: 'ui-button ui-button--primary', type: 'button', onClick: () => { setNotice({ type: '', message: '' }); setCreateOpen(true); } }, React.createElement('i', { className: 'bi bi-person-plus-fill' }), 'Create Account') : null
                ),
                notice.message ? React.createElement('div', { className: `ui-status ui-status--${notice.type}`, role: 'status', 'aria-live': 'polite' }, notice.message) : null,
                React.createElement('section', { className: 'ui-card user-filter-card', 'aria-labelledby': 'user-filter-title' },
                    React.createElement('div', { className: 'ui-card__body' },
                        React.createElement('h2', { id: 'user-filter-title', className: 'user-section-title' }, 'Search and filter'),
                        React.createElement('form', { className: 'user-filters', onSubmit: applyFilters },
                            React.createElement('div', { className: 'ui-field user-filters__search' },
                                React.createElement('label', { className: 'ui-label', htmlFor: 'user-search' }, 'Search'),
                                React.createElement('div', { className: 'user-search-control' },
                                    React.createElement('input', { id: 'user-search', className: 'ui-input', value: filters.search, placeholder: 'Search name or email', onChange: (event) => setFilters((current) => ({ ...current, search: event.target.value })) }),
                                    React.createElement('i', { className: 'bi bi-search', 'aria-hidden': 'true' })
                                )
                            ),
                            React.createElement('div', { className: 'ui-field' },
                                React.createElement('label', { className: 'ui-label', htmlFor: 'user-role' }, 'Role'),
                                React.createElement('select', { id: 'user-role', className: 'ui-select', value: filters.role_id, onChange: (event) => setFilters((current) => ({ ...current, role_id: event.target.value })) },
                                    React.createElement('option', { value: '' }, 'All roles'),
                                    roles.map((role) => React.createElement('option', { key: role.role_id, value: role.role_id }, role.role_name))
                                )
                            ),
                            React.createElement('div', { className: 'ui-field' },
                                React.createElement('label', { className: 'ui-label', htmlFor: 'user-status' }, 'Status'),
                                React.createElement('select', { id: 'user-status', className: 'ui-select', value: filters.status, onChange: (event) => setFilters((current) => ({ ...current, status: event.target.value })) },
                                    React.createElement('option', { value: '' }, 'All statuses'),
                                    React.createElement('option', { value: 'active' }, 'Active'),
                                    React.createElement('option', { value: 'inactive' }, 'Disabled'),
                                    React.createElement('option', { value: 'suspended' }, 'Suspended')
                                )
                            ),
                            React.createElement('div', { className: 'user-filter-actions' },
                                React.createElement('button', { className: 'ui-button ui-button--primary', type: 'submit', disabled: loading }, React.createElement('i', { className: 'bi bi-funnel-fill' }), 'Filter'),
                                React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: clearFilters, disabled: loading }, 'Clear')
                            )
                        )
                    )
                ),
                React.createElement('section', { className: 'ui-card user-list-card', 'aria-labelledby': 'user-list-title' },
                    React.createElement('div', { className: 'ui-card__header user-list-header' },
                        React.createElement('h2', { id: 'user-list-title', className: 'ui-card__title' }, 'User Accounts'),
                        React.createElement('span', { className: 'user-count' }, `${meta.total || 0} account${meta.total === 1 ? '' : 's'}`)
                    ),
                    React.createElement('div', { className: 'ui-table-wrap' },
                        React.createElement('table', { className: 'ui-table user-table' },
                            React.createElement('thead', null, React.createElement('tr', null,
                                ['Office / Agency', 'Name', 'Email', 'Role', 'Status', 'Updated', 'Action'].map((heading) => React.createElement('th', { key: heading, scope: 'col' }, heading))
                            )),
                            React.createElement('tbody', null,
                                loading && users.length === 0 ? React.createElement('tr', null, React.createElement('td', { colSpan: 7, className: 'ui-empty' }, 'Loading user accounts…')) : null,
                                !loading && users.length === 0 ? React.createElement('tr', null, React.createElement('td', { colSpan: 7, className: 'ui-empty' }, 'No user accounts match the current filters.')) : null,
                                users.map((user) => {
                                    const status = statusDetails(user.status);
                                    const restriction = restrictionFor(user);
                                    const actionLabel = user.status === 'active' ? 'Disable' : 'Enable';
                                    const actionDisabled = !canUpdateUsers || Boolean(restriction) || loading;
                                    const reason = !canUpdateUsers ? 'You do not have permission to update account status.' : restriction;
                                    return React.createElement('tr', { key: user.user_id },
                                        React.createElement('td', null, user.office || user.department || '—'),
                                        React.createElement('td', null, React.createElement('strong', null, user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim()), Number(user.user_id) === Number(accessSession?.userId) ? React.createElement('span', { className: 'user-current-label' }, 'You') : null),
                                        React.createElement('td', { className: 'user-email' }, user.email),
                                        React.createElement('td', null, user.role?.role_name || 'Unassigned'),
                                        React.createElement('td', null, React.createElement('span', { className: `ui-badge ui-badge--${status.badge}` }, status.label)),
                                        React.createElement('td', null, user.updated_at ? new Date(user.updated_at).toLocaleDateString() : '—'),
                                        React.createElement('td', null,
                                            canUpdateUsers ? React.createElement('div', { className: 'user-action' },
                                                React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: loading, title: `Edit ${user.name}'s details`, onClick: () => openEditDialog(user) }, React.createElement('i', { className: 'bi bi-pencil-fill' }), 'Edit'),
                                                React.createElement('button', { className: `ui-button ui-button--sm ${user.status === 'active' ? 'ui-button--danger' : 'ui-button--secondary'}`, type: 'button', disabled: actionDisabled, title: reason || `${actionLabel} ${user.name}`, onClick: () => requestStatusChange(user) }, actionLabel),
                                                reason ? React.createElement('span', { className: 'user-action__reason' }, React.createElement('i', { className: 'bi bi-lock-fill' }), reason) : null
                                            ) : React.createElement('span', { className: 'ui-help' }, 'View only')
                                        )
                                    );
                                })
                            )
                        )
                    ),
                    React.createElement('div', { className: 'ui-card__body ui-pagination' },
                        React.createElement('span', null, meta.total ? `Showing ${meta.from}–${meta.to} of ${meta.total}` : 'No accounts'),
                        React.createElement('div', { className: 'ui-pagination__actions' },
                            React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: loading || meta.current_page <= 1, onClick: () => loadUsers(meta.current_page - 1) }, React.createElement('i', { className: 'bi bi-chevron-left' }), 'Previous'),
                            React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: loading || meta.current_page >= meta.last_page, onClick: () => loadUsers(meta.current_page + 1) }, 'Next', React.createElement('i', { className: 'bi bi-chevron-right' }))
                        )
                    )
                )
            )
        ),
        createOpen ? React.createElement('div', { className: 'ui-dialog-backdrop', role: 'presentation' },
            React.createElement('section', { ref: createDialogRef, className: 'ui-dialog account-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'create-account-title' },
                React.createElement('div', { className: 'account-dialog__header' },
                    React.createElement('div', null, React.createElement('h2', { id: 'create-account-title' }, 'Create Account'), React.createElement('p', null, 'Enter the user details and assign an approved role.')),
                    React.createElement('button', { className: 'account-dialog__close', type: 'button', 'aria-label': 'Close create account dialog', onClick: closeCreateDialog, disabled: loading }, React.createElement('i', { className: 'bi bi-x-lg' }))
                ),
                React.createElement('form', { className: 'account-form', onSubmit: submitAccount },
                    React.createElement('div', { className: 'ui-form-grid ui-form-grid--2' },
                        [
                            ['first_name', 'First name', 'text', 'Jane'],
                            ['last_name', 'Last name', 'text', 'Doe'],
                            ['email', 'User account', 'email', 'name@example.com'],
                            ['office', 'Office / Agency', 'text', 'Head Office'],
                        ].map(([name, label, type, placeholder]) => React.createElement('div', { key: name, className: `ui-field${accountErrors[name] ? ' is-invalid' : ''}` },
                            React.createElement('label', { className: 'ui-label', htmlFor: `account-${name}` }, label, name !== 'office' ? React.createElement('span', { className: 'ui-required' }, ' *') : null),
                            React.createElement('input', { id: `account-${name}`, className: 'ui-input', type, placeholder, value: account[name], required: name !== 'office', onChange: (event) => setAccount((current) => ({ ...current, [name]: event.target.value })) }),
                            accountErrors[name] ? React.createElement('p', { className: 'ui-error' }, accountErrors[name][0]) : null
                        )),
                        React.createElement('div', { className: `ui-field${accountErrors.password ? ' is-invalid' : ''}` },
                            React.createElement('label', { className: 'ui-label', htmlFor: 'account-password' }, 'Password', React.createElement('span', { className: 'ui-required' }, ' *')),
                            React.createElement('input', { id: 'account-password', className: 'ui-input', type: 'password', autoComplete: 'new-password', value: account.password, required: true, minLength: 8, onChange: (event) => setAccount((current) => ({ ...current, password: event.target.value })) }),
                            React.createElement('p', { className: accountErrors.password ? 'ui-error' : 'ui-help' }, accountErrors.password?.[0] || 'Use at least 8 characters.' )
                        ),
                        React.createElement('div', { className: `ui-field${accountErrors.role_id ? ' is-invalid' : ''}` },
                            React.createElement('label', { className: 'ui-label', htmlFor: 'account-role' }, 'Role', React.createElement('span', { className: 'ui-required' }, ' *')),
                            React.createElement('select', { id: 'account-role', className: 'ui-select', value: account.role_id, required: true, onChange: (event) => setAccount((current) => ({ ...current, role_id: event.target.value })) },
                                React.createElement('option', { value: '' }, 'Select an approved role'),
                                roles.filter((role) => role.is_assignable).map((role) => React.createElement('option', { key: role.role_id, value: role.role_id, disabled: role.is_protected && !canAssignProtectedRoles }, `${role.role_name}${role.is_protected ? ' (Protected)' : ''}`))
                            ),
                            accountErrors.role_id ? React.createElement('p', { className: 'ui-error' }, accountErrors.role_id[0]) : null
                        )
                    ),
                    React.createElement('div', { className: 'account-dialog__actions' },
                        React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: closeCreateDialog, disabled: loading }, 'Cancel'),
                        React.createElement('button', { className: 'ui-button ui-button--primary', type: 'submit', disabled: loading }, React.createElement('i', { className: 'bi bi-person-check-fill' }), loading ? 'Creating…' : 'Create Account')
                    )
                )
            )
        ) : null,
        editOpen && editUser ? React.createElement('div', { className: 'ui-dialog-backdrop', role: 'presentation' },
            React.createElement('section', { ref: editDialogRef, className: 'ui-dialog account-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'edit-account-title' },
                React.createElement('div', { className: 'account-dialog__header' },
                    React.createElement('div', null,
                        React.createElement('h2', { id: 'edit-account-title' }, 'Edit Account'),
                        React.createElement('p', null, `Update the details for ${editUser.name || editUser.email}.`)
                    ),
                    React.createElement('button', { className: 'account-dialog__close', type: 'button', 'aria-label': 'Close edit account dialog', onClick: closeEditDialog, disabled: loading }, React.createElement('i', { className: 'bi bi-x-lg' }))
                ),
                React.createElement('form', { className: 'account-form', onSubmit: submitEdit },
                    editError ? React.createElement('p', { className: 'ui-error account-dialog__error', role: 'alert' },
                        React.createElement('i', { className: 'bi bi-exclamation-triangle-fill', 'aria-hidden': 'true' }),
                        ' ',
                        editError
                    ) : null,

                    React.createElement('div', { className: 'ui-form-grid ui-form-grid--2' },
                        EDIT_FIELDS.map(([name, label, type, required, maxLength]) => React.createElement('div', { key: name, className: `ui-field${editErrors[name] ? ' is-invalid' : ''}` },
                            React.createElement('label', { className: 'ui-label', htmlFor: `edit-${name}` }, label, required ? React.createElement('span', { className: 'ui-required' }, ' *') : null),
                            React.createElement('input', {
                                id: `edit-${name}`,
                                className: 'ui-input',
                                type,
                                value: editForm[name],
                                required,
                                maxLength,
                                max: type === 'date' ? today() : undefined,
                                'aria-invalid': editErrors[name] ? 'true' : undefined,
                                'aria-describedby': editErrors[name] ? `edit-${name}-error` : undefined,
                                onChange: (event) => setEditForm((current) => ({ ...current, [name]: event.target.value })),
                            }),
                            editErrors[name] ? React.createElement('p', { id: `edit-${name}-error`, className: 'ui-error' }, editErrors[name][0]) : null
                        )),

                        React.createElement('div', { className: `ui-field${editErrors.gender ? ' is-invalid' : ''}` },
                            React.createElement('label', { className: 'ui-label', htmlFor: 'edit-gender' }, 'Gender'),
                            React.createElement('select', {
                                id: 'edit-gender',
                                className: 'ui-select',
                                value: editForm.gender,
                                'aria-invalid': editErrors.gender ? 'true' : undefined,
                                'aria-describedby': editErrors.gender ? 'edit-gender-error' : undefined,
                                onChange: (event) => setEditForm((current) => ({ ...current, gender: event.target.value })),
                            },
                                GENDER_OPTIONS.map(([value, label]) => React.createElement('option', { key: value || 'unset', value }, label))
                            ),
                            editErrors.gender ? React.createElement('p', { id: 'edit-gender-error', className: 'ui-error' }, editErrors.gender[0]) : null
                        )
                    ),

                    // Restricted fields, shown so the administrator can see the
                    // current values and where to change them. Read-only rather
                    // than disabled: a disabled input is skipped by screen
                    // readers, which would hide the current role entirely.
                    React.createElement('div', { className: 'ui-form-grid ui-form-grid--2 user-edit__restricted' },
                        [
                            ['role', 'Role', editUser.role?.role_name || 'Unassigned', 'Change roles using the role assignment action.'],
                            ['status', 'Account status', statusDetails(editUser.status).label, 'Change status using the Enable or Disable action.'],
                        ].map(([name, label, value, help]) => React.createElement('div', { key: name, className: 'ui-field' },
                            React.createElement('label', { className: 'ui-label', htmlFor: `edit-locked-${name}` },
                                label,
                                React.createElement('i', { className: 'bi bi-lock-fill', 'aria-hidden': 'true' }),
                                React.createElement('span', { className: 'ui-visually-hidden' }, ' (read-only)')
                            ),
                            React.createElement('input', {
                                id: `edit-locked-${name}`,
                                className: 'ui-input',
                                type: 'text',
                                value,
                                readOnly: true,
                                'aria-readonly': 'true',
                                'aria-describedby': `edit-locked-${name}-help`,
                            }),
                            React.createElement('p', { id: `edit-locked-${name}-help`, className: 'ui-help' }, help)
                        ))
                    ),

                    editDirty ? React.createElement('p', { className: 'ui-help' }, React.createElement('i', { className: 'bi bi-exclamation-circle' }), ' You have unsaved changes.') : null,

                    React.createElement('div', { className: 'account-dialog__actions' },
                        React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: closeEditDialog, disabled: loading }, 'Cancel'),
                        React.createElement('button', { className: 'ui-button ui-button--primary', type: 'submit', disabled: loading || !editDirty }, React.createElement('i', { className: 'bi bi-check2' }), loading ? 'Saving…' : 'Save changes')
                    )
                )
            )
        ) : null,
        React.createElement(AppDialog, {
            open: dialog.open,
            variant: 'danger',
            title: `${selectedAction} account`,
            message: dialog.user ? `${selectedAction} ${dialog.user.name}'s account? ${selectedAction === 'Disable' ? 'They will no longer be able to sign in.' : 'They will regain access according to their assigned role and permissions.'}` : '',
            confirmLabel: `${selectedAction} account`,
            cancelLabel: 'Cancel',
            onConfirm: confirmStatusChange,
            onCancel: closeDialog,
        })
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(UserManagementApp));
