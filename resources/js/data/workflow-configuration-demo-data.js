export const demoWorkflow = {
    id: 'WF-001',
    name: 'Strategic Plan Approval',
    description:
        'Sequential review and approval for submitted strategic plans.',
    status: 'draft',
    stages: [
        {
            id: 1,
            name: 'Office Review',
            approverType: 'role',
            approver: 'Office',
        },
        {
            id: 2,
            name: 'Planning Review',
            approverType: 'role',
            approver: 'Planning Officer',
        },
        {
            id: 3,
            name: 'Final Approval',
            approverType: 'role',
            approver: 'Management',
        },
    ],
};

export const approverOptions = {
    role: [
        'Administrator',
        'test',
        'Office',
        'Planning Officer',
        'Management',
        'Technical Administrator',
    ],
    office: [
        'DOST Central Office',
        'Planning and Evaluation Service',
        'Office of the Secretary',
    ],
    unit: [
        'Strategic Planning Unit',
        'Monitoring and Evaluation Unit',
        'Policy Coordination Unit',
    ],
    user: [
        'Juan Dela Cruz',
        'Maria Santos',
        'Ana Reyes',
    ],
};
