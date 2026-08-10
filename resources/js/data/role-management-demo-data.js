export const demoRoles = [
    { id: 1, name: 'Administrator', description: 'Full system administration access.', protected: true },
    { id: 2, name: 'Technical Administrator', description: 'Manages users, roles, permissions, and system configuration.', protected: true },
    { id: 3, name: 'Planning Officer', description: 'Creates, reviews, and manages strategic plans.', protected: false },
    { id: 4, name: 'Planner/Encoder', description: 'Encodes plans and Strategic Objectives.', protected: false },
    { id: 5, name: 'Office Representative', description: 'Submits and reviews office inputs.', protected: false },
];

export const demoPermissions = [
    { id: 1, name: 'Manage Users', description: 'Create, update, and deactivate user accounts.' },
    { id: 2, name: 'Role & Permission Control', description: 'Assign roles and control user permissions.' },
    { id: 3, name: 'Planning Module Access', description: 'View and manage planning modules.' },
    { id: 4, name: 'Mapping Module Access', description: 'View and manage mappings.' },
    { id: 5, name: 'Reports Access', description: 'View and generate reports.' },
    { id: 6, name: 'System Settings', description: 'Configure system settings and options.' },
];

export const demoUsers = [
    { id: 1, name: 'Taylor Cruz', email: 'taylor.cruz@spdms.gov.ph', department: 'Administration', roleIds: [1], permissionIds: [1, 2, 3, 4, 5, 6] },
    { id: 2, name: 'Katie Reyes', email: 'katie.reyes@spdms.gov.ph', department: 'ICT Office', roleIds: [2], permissionIds: [1, 2, 3, 4, 5] },
    { id: 3, name: 'Joy Santos', email: 'joy.santos@spdms.gov.ph', department: 'Planning Office', roleIds: [3], permissionIds: [3, 4, 5] },
    { id: 4, name: 'John Dela Cruz', email: 'john.delacruz@spdms.gov.ph', department: 'Planning Office', roleIds: [4], permissionIds: [3, 5] },
    { id: 5, name: 'Maria Garcia', email: 'maria.garcia@spdms.gov.ph', department: 'Regional Office', roleIds: [5], permissionIds: [3] },
];
