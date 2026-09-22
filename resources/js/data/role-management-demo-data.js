export const demoRoles = [
    { id: 1, name: 'Administrator', description: 'Full system administration access.', protected: true },
    { id: 2, name: 'Technical Administrator', description: 'Manages users, roles, permissions, and system configuration.', protected: true },
    { id: 3, name: 'Planning Officer', description: 'Can create, review, update, and archive; cannot delete.', protected: false },
    { id: 4, name: 'test', description: 'Full system access for testing.', protected: true },
    { id: 5, name: 'Office', description: 'Read-only access to published plans and reports.', protected: false },
    { id: 6, name: 'Management', description: 'Reviews and approves plans within their division.', protected: false },
];

export const demoPermissions = [
    { id: 1, name: 'Manage Users', description: 'Create, update, and deactivate user accounts.' },
    { id: 2, name: 'Role & Permission Control', description: 'Assign roles and control user permissions.' },
    { id: 3, name: 'Planning Module Access', description: 'View and manage planning modules.' },
    { id: 4, name: 'Mapping Module Access', description: 'View and manage mappings.' },
    { id: 5, name: 'Reports Access', description: 'View and generate reports.' },
    { id: 6, name: 'System Settings', description: 'Configure system settings and options.' },
    { id: 7, name: 'Create', description: 'Create planning records and related content.' },
    { id: 8, name: 'Review', description: 'Review planning records and related content.' },
    { id: 9, name: 'Update', description: 'Update planning records and related content.' },
    { id: 10, name: 'Archive', description: 'Archive and restore planning records.' },
    { id: 11, name: 'Delete', description: 'Permanently delete planning records.' },
];

export const demoUsers = [
    { id: 1, name: 'Taylor Cruz', email: 'taylor.cruz@spdms.gov.ph', department: 'Administration', roleIds: [1], permissionIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { id: 2, name: 'Katie Reyes', email: 'katie.reyes@spdms.gov.ph', department: 'ICT Office', roleIds: [2], permissionIds: [1, 2, 6] },
    { id: 3, name: 'Joy Santos', email: 'joy.santos@spdms.gov.ph', department: 'Planning Office', roleIds: [3], permissionIds: [3, 4, 5, 7, 8, 9, 10] },
    { id: 4, name: 'John Dela Cruz', email: 'john.delacruz@spdms.gov.ph', department: 'Testing', roleIds: [4], permissionIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { id: 5, name: 'Maria Garcia', email: 'maria.garcia@spdms.gov.ph', department: 'Regional Office', roleIds: [5], permissionIds: [3, 5] },
    { id: 6, name: 'Alex Rivera', email: 'alex.rivera@spdms.gov.ph', department: 'Executive Office', roleIds: [6], permissionIds: [3, 5] },
];
