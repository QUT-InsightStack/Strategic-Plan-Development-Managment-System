import { displayRoleName } from './access/role-labels.js';

(function () {

    const messages = {
        help: 'Help resources are not connected yet.',
        contact: 'Contact details will be provided by the system administrator.',
        support: 'Support access is available for assigned users.',
        privacy: 'Privacy Notice content is not connected yet.',
        terms: 'Terms of Use content is not connected yet.',
        accessibility: 'Accessibility information is not connected yet.',
    };

    const idFields = [
        'user_id',
        'role_id',
        'permission_id',
        'foundation_id',
        'record_id',
        'relation_id',
        'link_id',
        'log_id',
        'id',
    ];

    const resourceSchemas = {
        users: {
            title: 'Users',
            singular: 'User',
            idField: 'user_id',
            displayColumns: ['user_id', 'first_name', 'last_name', 'email', 'department', 'role_id', 'status'],
            fields: [
                { name: 'first_name', label: 'First Name', type: 'text', required: true, placeholder: 'Jane' },
                { name: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Doe' },
                { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'name@example.com' },
                {
                    name: 'password',
                    label: 'New Password',
                    type: 'password',
                    requiredOnCreate: true,
                    omitWhenBlankOnEdit: true,
                    placeholder: 'Leave blank to keep current password',
                    passwordPolicy: true,
                },
                { name: 'mobile', label: 'Mobile', type: 'text', placeholder: '+61 400 000 000' },
                { name: 'department', label: 'Department', type: 'text', placeholder: 'Planning Division' },
                {
                    name: 'unit',
                    label: 'Unit',
                    type: 'select',
                    allowEmpty: true,
                    options: [
                        { value: 'Planning', label: 'Planning' },
                        { value: 'Operations', label: 'Operations' },
                        { value: 'Finance', label: 'Finance' },
                        { value: 'HR', label: 'HR' },
                        { value: 'IT', label: 'IT' },
                        { value: 'Executive', label: 'Executive' },
                    ],
                },
                {
                    name: 'office',
                    label: 'Office',
                    type: 'select',
                    allowEmpty: true,
                    options: [
                        { value: 'Head Office', label: 'Head Office' },
                        { value: 'Regional Office', label: 'Regional Office' },
                        { value: 'Branch Office', label: 'Branch Office' },
                    ],
                },
                { name: 'position', label: 'Position', type: 'text', placeholder: 'Senior Analyst' },
                {
                    name: 'role_id',
                    label: 'Role',
                    type: 'select',
                    optionsResource: 'roles',
                    allowEmpty: true,
                    valueType: 'number',
                },
                {
                    name: 'status',
                    label: 'Status',
                    type: 'select',
                    required: true,
                    defaultValue: 'active',
                    options: [
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                        { value: 'suspended', label: 'Suspended' },
                    ],
                },
            ],
        },
        roles: {
            title: 'Roles',
            singular: 'Role',
            idField: 'role_id',
            displayColumns: ['role_id', 'role_name', 'description', 'created_at', 'updated_at'],
            fields: [
                { name: 'role_name', label: 'Role Name', type: 'text', required: true, placeholder: 'Management' },
                { name: 'description', label: 'Description', type: 'textarea', rows: 4, fullWidth: true },
            ],
        },
        permissions: {
            title: 'Permissions',
            singular: 'Permission',
            idField: 'permission_id',
            displayColumns: ['permission_id', 'permission_name', 'code', 'module', 'description'],
            fields: [
                { name: 'permission_name', label: 'Permission Name', type: 'text', required: true },
                { name: 'code', label: 'Code', type: 'text', required: true, placeholder: 'plans.create' },
                { name: 'module', label: 'Module', type: 'text', required: true, placeholder: 'strategic_plans' },
                { name: 'description', label: 'Description', type: 'textarea', rows: 4, fullWidth: true },
            ],
        },
        'strategic-foundations': {
            title: 'Strategic Foundations',
            singular: 'Strategic Foundation',
            idField: 'foundation_id',
            displayColumns: ['foundation_id', 'type', 'content', 'version', 'created_by', 'updated_by'],
            fields: [
                {
                    name: 'type',
                    label: 'Type',
                    type: 'select',
                    required: true,
                    options: [
                        { value: 'MISSION', label: 'Mission' },
                        { value: 'VISION', label: 'Vision' },
                        { value: 'CORE_VALUE', label: 'Core Value' },
                    ],
                },
                { name: 'content', label: 'Content', type: 'textarea', rows: 5, required: true, fullWidth: true },
                { name: 'version', label: 'Version', type: 'text', required: true, placeholder: 'v1' },
                {
                    name: 'created_by',
                    label: 'Created By',
                    type: 'select',
                    optionsResource: 'users',
                    required: true,
                    valueType: 'number',
                    defaultFromCurrentUser: true,
                },
                {
                    name: 'updated_by',
                    label: 'Updated By',
                    type: 'select',
                    optionsResource: 'users',
                    allowEmpty: true,
                    valueType: 'number',
                    defaultFromCurrentUser: true,
                },
            ],
        },
        'strategic-records': {
            title: 'Strategic Records',
            singular: 'Strategic Record',
            idField: 'record_id',
            displayColumns: ['record_id', 'level', 'title', 'description', 'mission_id', 'vision_id', 'created_by', 'updated_by'],
            fields: [
                { name: 'level', label: 'Level', type: 'text', required: true, placeholder: 'Goal, Objective, Initiative' },
                { name: 'title', label: 'Title', type: 'text', required: true, fullWidth: true },
                { name: 'description', label: 'Description', type: 'textarea', rows: 5, fullWidth: true },
                {
                    name: 'mission_id',
                    label: 'Mission',
                    type: 'select',
                    optionsResource: 'strategic-foundations',
                    optionQuery: '?type=MISSION',
                    required: true,
                    valueType: 'number',
                },
                {
                    name: 'vision_id',
                    label: 'Vision',
                    type: 'select',
                    optionsResource: 'strategic-foundations',
                    optionQuery: '?type=VISION',
                    required: true,
                    valueType: 'number',
                },
                {
                    name: 'parent_ids',
                    label: 'Parent Records',
                    type: 'select',
                    optionsResource: 'strategic-records',
                    multiple: true,
                    valueType: 'number',
                    fullWidth: true,
                },
                {
                    name: 'created_by',
                    label: 'Created By',
                    type: 'select',
                    optionsResource: 'users',
                    required: true,
                    valueType: 'number',
                    defaultFromCurrentUser: true,
                },
                {
                    name: 'updated_by',
                    label: 'Updated By',
                    type: 'select',
                    optionsResource: 'users',
                    allowEmpty: true,
                    valueType: 'number',
                    defaultFromCurrentUser: true,
                },
            ],
        },
        relations: {
            title: 'Relations',
            singular: 'Relation',
            idField: 'relation_id',
            displayColumns: ['relation_id', 'record_id', 'parent_id', 'created_by'],
            fields: [
                {
                    name: 'record_id',
                    label: 'Record',
                    type: 'select',
                    optionsResource: 'strategic-records',
                    required: true,
                    valueType: 'number',
                },
                {
                    name: 'parent_id',
                    label: 'Parent Record',
                    type: 'select',
                    optionsResource: 'strategic-records',
                    required: true,
                    valueType: 'number',
                },
                {
                    name: 'created_by',
                    label: 'Created By',
                    type: 'select',
                    optionsResource: 'users',
                    required: true,
                    valueType: 'number',
                    defaultFromCurrentUser: true,
                },
            ],
        },
        logs: {
            title: 'Activity Logs',
            singular: 'Activity Log',
            idField: 'log_id',
            displayColumns: ['log_id', 'user_id', 'operation', 'states', 'created_at'],
            fields: [
                {
                    name: 'user_id',
                    label: 'User',
                    type: 'select',
                    optionsResource: 'users',
                    required: true,
                    valueType: 'number',
                    defaultFromCurrentUser: true,
                },
                { name: 'operation', label: 'Operation', type: 'textarea', rows: 4, required: true, fullWidth: true },
                { name: 'states', label: 'State', type: 'text', placeholder: 'created, updated, failed' },
            ],
        },
        'role-premissions': {
            title: 'Role Permissions',
            singular: 'Role Permission',
            idField: 'relation_id',
            displayColumns: ['relation_id', 'role_id', 'permission_id'],
            fields: [
                {
                    name: 'role_id',
                    label: 'Role',
                    type: 'select',
                    optionsResource: 'roles',
                    required: true,
                    valueType: 'number',
                },
                {
                    name: 'permission_id',
                    label: 'Permission',
                    type: 'select',
                    optionsResource: 'permissions',
                    required: true,
                    valueType: 'number',
                },
            ],
        },
        'plan-core-values': {
            title: 'Plan Core Values',
            singular: 'Plan Core Value',
            idField: 'link_id',
            displayColumns: ['link_id', 'plan_id', 'core_value_id', 'created_by', 'updated_by'],
            fields: [
                {
                    name: 'plan_id',
                    label: 'Plan',
                    type: 'select',
                    optionsResource: 'strategic-records',
                    required: true,
                    valueType: 'number',
                },
                {
                    name: 'core_value_id',
                    label: 'Core Value',
                    type: 'select',
                    optionsResource: 'strategic-foundations',
                    optionQuery: '?type=CORE_VALUE',
                    required: true,
                    valueType: 'number',
                },
                {
                    name: 'created_by',
                    label: 'Created By',
                    type: 'select',
                    optionsResource: 'users',
                    required: true,
                    valueType: 'number',
                    defaultFromCurrentUser: true,
                },
                {
                    name: 'updated_by',
                    label: 'Updated By',
                    type: 'select',
                    optionsResource: 'users',
                    required: true,
                    valueType: 'number',
                    defaultFromCurrentUser: true,
                },
            ],
        },
    };

    function formatLabel(value) {
        return String(value)
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function extractData(responseBody) {
        return responseBody?.data ?? responseBody;
    }

    function getSchema(resourceName) {
        return resourceSchemas[resourceName] || null;
    }

    function resolveId(resourceName, item) {
        const schema = getSchema(resourceName);
        const fields = schema?.idField ? [schema.idField, ...idFields] : idFields;

        for (const field of fields) {
            if (item && Object.prototype.hasOwnProperty.call(item, field) && item[field] !== null && item[field] !== undefined) {
                return item[field];
            }
        }

        return null;
    }

    function formatCellValue(value, fieldName = '') {
        if (value === null || value === undefined || value === '') {
            return '-';
        }

        if (fieldName === 'role_name') {
            return displayRoleName(value);
        }

        if (Array.isArray(value)) {
            return value.length ? value.map((item) => formatCellValue(item)).join(', ') : '-';
        }

        if (typeof value === 'object') {
            return describeRecord('', value);
        }

        return String(value);
    }

    function describeRecord(resourceName, record) {
        if (!record || typeof record !== 'object') {
            return String(record ?? '');
        }

        const id = resolveId(resourceName, record);
        const prefix = id ? `${id} - ` : '';

        const knownValue =
            (record.role_name ? displayRoleName(record.role_name) : null) ||
            record.permission_name ||
            record.name ||
            [record.first_name, record.last_name].filter(Boolean).join(' ') ||
            record.email ||
            record.title ||
            record.content ||
            record.code ||
            record.operation ||
            record.description ||
            record.type;

        if (knownValue) {
            return `${prefix}${String(knownValue).slice(0, 80)}`;
        }

        return prefix ? prefix.slice(0, -3) : JSON.stringify(record);
    }

    window.ResourceCrud = {
        messages,
        resourceSchemas,
        formatLabel,
        formatCellValue,
        describeRecord,
        extractData,
        getSchema,
        resolveId,
    };
})();
