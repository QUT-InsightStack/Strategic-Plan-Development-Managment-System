(function () {
    const messages = {
        help: 'Help resources are not connected yet.',
        contact: 'Contact details will be provided by the system administrator.',
        support: 'Support access is available for assigned users.',
        privacy: 'Privacy Notice content is not connected yet.',
        terms: 'Terms of Use content is not connected yet.',
        accessibility: 'Accessibility information is not connected yet.',
    };

    const fallbackStoreKey = 'spdms.resourceFallback.v2';
    const idFields = ['user_id', 'role_id', 'permission_id', 'foundation_id', 'record_id', 'relation_id', 'link_id', 'log_id', 'id'];
    const foundationResourceByType = {
        MISSION: 'missions',
        VISION: 'visions',
        CORE_VALUE: 'core-values',
    };

    const foundationAuditFields = [
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
    ];

    const foundationContentFields = [
        { name: 'content', label: 'Content', type: 'textarea', rows: 5, required: true, fullWidth: true },
        { name: 'version', label: 'Version', type: 'text', required: true, placeholder: 'v1' },
        ...foundationAuditFields,
    ];

    const resourceSchemas = {
        users: {
            title: 'Users',
            singular: 'User',
            idField: 'user_id',
            displayColumns: ['user_id', 'first_name', 'last_name', 'email', 'department', 'role_id', 'status'],
            fields: [
                { name: 'name', label: 'Full Name', type: 'text', required: true, placeholder: 'Jane Doe' },
                { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'name@example.com' },
                { name: 'password', label: 'Password', type: 'password', requiredOnCreate: true, omitWhenBlankOnEdit: true, placeholder: 'Leave blank to keep current password' },
                { name: 'department', label: 'Department', type: 'text', placeholder: 'Planning Division' },
                { name: 'role_id', label: 'Role', type: 'select', optionsResource: 'roles', allowEmpty: true, valueType: 'number' },
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
                { name: 'role_name', label: 'Role Name', type: 'text', required: true, placeholder: 'Division Head' },
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
        missions: {
            title: 'Mission',
            singular: 'Mission',
            apiResource: 'strategic-foundations',
            apiQuery: '?type=MISSION',
            idField: 'foundation_id',
            fixedValues: { type: 'MISSION' },
            displayColumns: ['foundation_id', 'content', 'version', 'updated_by', 'updated_at'],
            fields: foundationContentFields,
        },
        visions: {
            title: 'Vision',
            singular: 'Vision',
            apiResource: 'strategic-foundations',
            apiQuery: '?type=VISION',
            idField: 'foundation_id',
            fixedValues: { type: 'VISION' },
            displayColumns: ['foundation_id', 'content', 'version', 'updated_by', 'updated_at'],
            fields: foundationContentFields,
        },
        'core-values': {
            title: 'Core Values',
            singular: 'Core Value',
            apiResource: 'strategic-foundations',
            apiQuery: '?type=CORE_VALUE',
            idField: 'foundation_id',
            fixedValues: { type: 'CORE_VALUE' },
            displayColumns: ['foundation_id', 'content', 'version', 'updated_by', 'updated_at'],
            fields: foundationContentFields,
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
                ...foundationContentFields,
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
                { name: 'mission_id', label: 'Mission', type: 'select', optionsResource: 'missions', required: true, valueType: 'number' },
                { name: 'vision_id', label: 'Vision', type: 'select', optionsResource: 'visions', required: true, valueType: 'number' },
                { name: 'parent_ids', label: 'Parent Records', type: 'select', optionsResource: 'strategic-records', multiple: true, valueType: 'number', fullWidth: true },
                ...foundationAuditFields,
            ],
        },
        relations: {
            title: 'Relations',
            singular: 'Relation',
            idField: 'relation_id',
            displayColumns: ['relation_id', 'record_id', 'parent_id', 'created_by'],
            fields: [
                { name: 'record_id', label: 'Record', type: 'select', optionsResource: 'strategic-records', required: true, valueType: 'number' },
                { name: 'parent_id', label: 'Parent Record', type: 'select', optionsResource: 'strategic-records', required: true, valueType: 'number' },
                foundationAuditFields[0],
            ],
        },
        logs: {
            title: 'Activity Logs',
            singular: 'Activity Log',
            idField: 'log_id',
            displayColumns: ['log_id', 'user_id', 'operation', 'states', 'created_at'],
            fields: [
                { name: 'user_id', label: 'User', type: 'select', optionsResource: 'users', required: true, valueType: 'number', defaultFromCurrentUser: true },
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
                { name: 'role_id', label: 'Role', type: 'select', optionsResource: 'roles', required: true, valueType: 'number' },
                { name: 'permission_id', label: 'Permission', type: 'select', optionsResource: 'permissions', required: true, valueType: 'number' },
            ],
        },
        'plan-core-values': {
            title: 'Plan/Core Value Mapping',
            singular: 'Plan Core Value Link',
            idField: 'link_id',
            displayColumns: ['link_id', 'plan_id', 'core_value_id', 'created_by', 'updated_by'],
            fields: [
                { name: 'plan_id', label: 'Plan', type: 'select', optionsResource: 'strategic-records', required: true, valueType: 'number' },
                { name: 'core_value_id', label: 'Core Value', type: 'select', optionsResource: 'core-values', required: true, valueType: 'number' },
                ...foundationAuditFields,
            ],
        },
    };

    const sampleData = {
        users: [
            { user_id: 1, first_name: 'Lucy', last_name: 'Ade', name: 'Lucy Ade', email: 'lucy.ade@example.com', department: 'DOST', role_id: 1, status: 'active' },
            { user_id: 2, first_name: 'Planning', last_name: 'Officer', name: 'Planning Officer', email: 'planner@example.com', department: 'Planning Division', role_id: 2, status: 'active' },
        ],
        roles: [
            { role_id: 1, role_name: 'Administrator', description: 'Full system access.' },
            { role_id: 2, role_name: 'Planning Officer', description: 'Creates and manages strategic plans.' },
        ],
        permissions: [
            { permission_id: 1, permission_name: 'View plans', code: 'plans.view', module: 'strategic_plans', description: 'Can view plans.' },
        ],
        missions: [
            { foundation_id: 1, type: 'MISSION', content: 'Deliver science, technology, and innovation services for inclusive national growth.', version: 'v1', created_by: 1, updated_by: 1 },
        ],
        visions: [
            { foundation_id: 2, type: 'VISION', content: 'A future-ready strategic planning system with transparent progress monitoring.', version: 'v1', created_by: 1, updated_by: 1 },
        ],
        'core-values': [
            { foundation_id: 3, type: 'CORE_VALUE', content: 'Integrity', version: 'v1', created_by: 1, updated_by: 1 },
            { foundation_id: 4, type: 'CORE_VALUE', content: 'Service Excellence', version: 'v1', created_by: 1, updated_by: 1 },
        ],
        'strategic-records': [
            { record_id: 5001, level: 'Objective', title: 'DOST strategic plan', description: 'Sample strategic objective.', mission_id: 1, vision_id: 2, created_by: 1, updated_by: 1 },
        ],
        relations: [],
        logs: [],
        'role-premissions': [],
        'plan-core-values': [
            { link_id: 1, plan_id: 5001, core_value_id: 3, created_by: 1, updated_by: 1 },
        ],
    };

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function getSchema(resourceName) {
        return resourceSchemas[resourceName] || null;
    }

    function apiResourceName(resourceName) {
        return getSchema(resourceName)?.apiResource || resourceName;
    }

    function listUrl(resourceName) {
        const schema = getSchema(resourceName);
        return `/api/${apiResourceName(resourceName)}${schema?.apiQuery || ''}`;
    }

    function recordUrl(resourceName, id) {
        return `/api/${apiResourceName(resourceName)}/${id}`;
    }

    function formatLabel(value) {
        return String(value)
            .replace(/[_-]+/g, ' ')
            .replace(/\b\w/g, (letter) => letter.toUpperCase());
    }

    function extractData(responseBody) {
        return responseBody?.data ?? responseBody;
    }

    function readStore() {
        try {
            const parsed = JSON.parse(window.localStorage.getItem(fallbackStoreKey) || 'null');
            return parsed ? { ...clone(sampleData), ...parsed } : clone(sampleData);
        } catch (error) {
            return clone(sampleData);
        }
    }

    function writeStore(store) {
        window.localStorage.setItem(fallbackStoreKey, JSON.stringify(store));
    }

    function foundationsFromStore(store) {
        return [...store.missions, ...store.visions, ...store['core-values']];
    }

    function storeList(resourceName, store = readStore()) {
        if (resourceName === 'strategic-foundations') {
            return foundationsFromStore(store);
        }

        return store[resourceName] || [];
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

    function nextId(resourceName, store) {
        const schema = getSchema(resourceName);
        const idField = schema?.idField || 'id';
        const sourceList = idField === 'foundation_id' ? foundationsFromStore(store) : storeList(resourceName, store);
        const values = sourceList.map((item) => Number(item[idField]) || 0);
        return Math.max(0, ...values) + 1;
    }

    function applyFixedValues(resourceName, payload) {
        return {
            ...(payload || {}),
            ...(getSchema(resourceName)?.fixedValues || {}),
        };
    }

    function saveToStore(resourceName, id, payload) {
        const schema = getSchema(resourceName);
        const idField = schema?.idField || 'id';
        const store = readStore();
        const now = new Date().toISOString();
        const nextPayload = applyFixedValues(resourceName, {
            ...payload,
            updated_at: now,
        });
        const existingFoundation =
            resourceName === 'strategic-foundations' && id
                ? foundationsFromStore(store).find((item) => String(item[idField]) === String(id))
                : null;
        const targetResourceName =
            resourceName === 'strategic-foundations'
                ? foundationResourceByType[nextPayload.type || existingFoundation?.type] || 'core-values'
                : resourceName;
        const list = [...storeList(targetResourceName, store)];

        if (id) {
            const index = list.findIndex((item) => String(item[idField]) === String(id));
            if (index === -1) {
                throw new Error(`${schema?.singular || 'Record'} not found in sample data.`);
            }
            list[index] = { ...list[index], ...nextPayload };
        } else {
            list.push({
                [idField]: nextId(resourceName, store),
                created_at: now,
                ...nextPayload,
            });
        }

        store[targetResourceName] = list;
        writeStore(store);
        return id ? list.find((item) => String(item[idField]) === String(id)) : list[list.length - 1];
    }

    function deleteFromStore(resourceName, id) {
        const schema = getSchema(resourceName);
        const idField = schema?.idField || 'id';
        const store = readStore();

        if (resourceName === 'strategic-foundations') {
            let deleted = false;
            Object.values(foundationResourceByType).forEach((foundationResource) => {
                const list = storeList(foundationResource, store);
                const nextList = list.filter((item) => String(item[idField]) !== String(id));
                deleted = deleted || nextList.length !== list.length;
                store[foundationResource] = nextList;
            });
            writeStore(store);
            return deleted;
        }

        const list = storeList(resourceName, store);
        const nextList = list.filter((item) => String(item[idField]) !== String(id));

        store[resourceName] = nextList;
        writeStore(store);
        return nextList.length !== list.length;
    }

    function fallbackReason(error) {
        if (!error) {
            return 'sample';
        }

        if (error.status === 401 || error.status === 403) {
            return 'sample: auth unavailable';
        }

        if (error.status === 404 || error.name === 'TypeError') {
            return 'sample: API unavailable';
        }

        return '';
    }

    function formatCellValue(value) {
        if (value === null || value === undefined || value === '') {
            return '-';
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
            record.role_name ||
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

    function normalizeResourceData(resourceName, data) {
        const fixedType = getSchema(resourceName)?.fixedValues?.type;

        if (!fixedType || !Array.isArray(data)) {
            return data;
        }

        return data.filter((item) => item?.type === fixedType);
    }

    async function requestJson(url, options = {}) {
        const headers = {
            Accept: 'application/json',
            ...(options.headers || {}),
        };

        let response;

        try {
            response = await fetch(url, {
                credentials: 'include',
                ...options,
                headers,
            });
        } catch (error) {
            error.name = error.name || 'TypeError';
            throw error;
        }

        const contentType = response.headers.get('content-type') || '';
        const body = contentType.includes('application/json') ? await response.json() : null;

        if (!response.ok) {
            const error = new Error(body?.message || 'Request failed.');
            error.status = response.status;
            error.body = body;
            throw error;
        }

        return body;
    }

    async function listResource(resourceName) {
        try {
            const response = await requestJson(listUrl(resourceName));
            return { data: normalizeResourceData(resourceName, extractData(response)), source: 'api' };
        } catch (error) {
            const reason = fallbackReason(error);
            if (!reason) {
                throw error;
            }
            return { data: storeList(resourceName), source: reason };
        }
    }

    async function getResource(resourceName, id) {
        try {
            const response = await requestJson(recordUrl(resourceName, id));
            return { data: extractData(response), source: 'api' };
        } catch (error) {
            const reason = fallbackReason(error);
            if (!reason) {
                throw error;
            }
            const record = storeList(resourceName).find((item) => String(resolveId(resourceName, item)) === String(id));
            if (!record) {
                throw new Error(`${getSchema(resourceName)?.singular || 'Record'} not found.`);
            }
            return { data: record, source: reason };
        }
    }

    async function saveResource(resourceName, id, payload) {
        const method = id ? 'PUT' : 'POST';

        try {
            const response = await requestJson(id ? recordUrl(resourceName, id) : `/api/${apiResourceName(resourceName)}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(applyFixedValues(resourceName, payload)),
            });
            return { data: extractData(response), source: 'api' };
        } catch (error) {
            const reason = fallbackReason(error);
            if (!reason || error.status === 422) {
                throw error;
            }
            return { data: saveToStore(resourceName, id, payload), source: reason };
        }
    }

    async function deleteResource(resourceName, id) {
        try {
            const response = await requestJson(recordUrl(resourceName, id), { method: 'DELETE' });
            return { data: extractData(response), source: 'api' };
        } catch (error) {
            const reason = fallbackReason(error);
            if (!reason) {
                throw error;
            }
            const deleted = deleteFromStore(resourceName, id);
            if (!deleted) {
                throw new Error(`${getSchema(resourceName)?.singular || 'Record'} not found in sample data.`);
            }
            return { data: { message: 'Deleted from sample data' }, source: reason };
        }
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
        listResource,
        getResource,
        saveResource,
        deleteResource,
        requestJson,
    };
})();
