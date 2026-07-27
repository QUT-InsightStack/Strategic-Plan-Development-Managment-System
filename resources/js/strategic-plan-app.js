import { BrandLogo } from './brand-logo.js';

const { useState, useEffect } = React;
const rootElement = document.getElementById('root');
const dashboardUrl = '/dashboard';
const profileUrl = '/profile';
const strategicPlanUrl = '/strategic-plan';
const loginUrl = '/login';

// SPDMS-212: Static/sample data for demonstration
const STATIC_DATA = {
    mission: 'To deliver innovative and sustainable solutions that empower communities, drive excellence, and create lasting value for all stakeholders.',
    vision: 'To be a globally recognised leader in strategic development, fostering a culture of integrity, collaboration, and continuous improvement by 2030.',
    coreValues: [
        { id: 1, title: 'Integrity', description: 'We act with honesty and transparency in everything we do.' },
        { id: 2, title: 'Innovation', description: 'We embrace creative thinking to solve complex challenges.' },
        { id: 3, title: 'Collaboration', description: 'We work together across teams and boundaries to achieve shared goals.' },
    ],
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ collapsed, onToggle }) {
    const navItems = [
        { label: 'Dashboard', icon: 'bi-house', href: dashboardUrl },
        { label: 'Strategic Plan', icon: 'bi-bullseye', href: strategicPlanUrl, active: true },
        { label: 'Profile', icon: 'bi-person', href: profileUrl },
    ];

    return React.createElement(
        'div',
        { className: `sidebar${collapsed ? ' collapsed' : ''}`, id: 'sidebar' },
        React.createElement(
            'a',
            { href: dashboardUrl, className: 'sidebar-logo' },
            React.createElement(BrandLogo, { className: 'sidebar-logo-image' }),
            !collapsed && React.createElement('p', { className: 'sidebar-title' }, 'SPDMS')
        ),
        React.createElement(
            'nav',
            { className: 'sidebar-nav' },
            navItems.map((item) =>
                React.createElement(
                    'a',
                    { key: item.label, href: item.href, className: `sidebar-item${item.active ? ' active' : ''}` },
                    React.createElement('i', { className: `bi ${item.icon} sidebar-item-icon` }),
                    React.createElement('span', { className: 'sidebar-item-label' }, item.label)
                )
            )
        ),
        React.createElement(
            'button',
            { className: 'collapse-btn', onClick: onToggle },
            React.createElement('i', { className: `bi ${collapsed ? 'bi-chevron-right' : 'bi-chevron-left'}` })
        )
    );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({ onLogout }) {
    return React.createElement(
        'div',
        { className: 'office-topbar' },
        React.createElement('button', { className: 'office-topbar-btn', onClick: () => { window.location.href = profileUrl; } }, React.createElement('i', { className: 'bi bi-person me-1' }), 'Profile'),
        React.createElement('button', { className: 'office-topbar-btn logout', onClick: onLogout }, React.createElement('i', { className: 'bi bi-box-arrow-right me-1' }), 'Logout')
    );
}

// ─── Status message ───────────────────────────────────────────────────────────

function StatusMsg({ message, type }) {
    if (!message) return null;
    return React.createElement('div', { className: `office-status is-${type} mt-2`, role: 'alert' }, message);
}

// ─── SPDMS-206: Mission Section ───────────────────────────────────────────────

function MissionSection({ mission, onSave }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(mission);
    const [error, setError] = useState('');
    const [status, setStatus] = useState({ message: '', type: 'info' });

    useEffect(() => {
        if (!editing) setValue(mission);
    }, [mission, editing]);

    function handleSave() {
        if (!value.trim()) { setError('Mission statement cannot be empty.'); return; }
        setError('');
        onSave('mission', value.trim());
        setEditing(false);
        setStatus({ message: 'Mission saved successfully.', type: 'success' });
        setTimeout(() => setStatus({ message: '', type: 'info' }), 3000);
    }

    function handleCancel() { setValue(mission); setError(''); setEditing(false); }

    return React.createElement(
        'div',
        { className: 'task-card shadow-sm' },
        React.createElement(
            'div',
            { className: 'task-card-header' },
            React.createElement(
                'h5',
                { className: 'task-card-title' },
                React.createElement(
                    'span',
                    { className: 'task-card-icon icon-mission' },
                    React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                        React.createElement('circle', { cx: '12', cy: '12', r: '10' }),
                        React.createElement('path', { d: 'M12 8v4l3 3' })
                    )
                ),
                'Mission Statement'
            ),
            !editing && React.createElement(
                'button',
                { className: 'office-btn office-btn-primary', onClick: () => { setValue(mission); setEditing(true); } },
                React.createElement('i', { className: 'bi bi-pencil me-1' }),
                'Update'
            )
        ),
        React.createElement('p', { className: 'task-card-subtitle' }, 'Define the purpose and primary objectives of your organisation.'),
        React.createElement(
            'div',
            { className: 'task-card-body' },
            editing
                ? React.createElement(
                    React.Fragment, null,
                    React.createElement(
                        'div',
                        { className: `office-field-group${error ? ' has-error' : ''}` },
                        React.createElement('label', { className: 'office-label', htmlFor: 'mission-input' }, 'Mission Statement', React.createElement('span', { className: 'required-mark' }, '*')),
                        React.createElement('textarea', {
                            id: 'mission-input',
                            className: 'office-textarea',
                            value,
                            rows: 4,
                            placeholder: "Enter your organisation's mission statement...",
                            onChange: (e) => { setValue(e.target.value); setError(''); },
                        }),
                        error && React.createElement('p', { className: 'office-field-error' }, error)
                    ),
                    React.createElement(
                        'div',
                        { className: 'office-actions' },
                        React.createElement('button', { className: 'office-btn office-btn-primary', onClick: handleSave }, React.createElement('i', { className: 'bi bi-check-lg me-1' }), 'Save Mission'),
                        React.createElement('button', { className: 'office-btn office-btn-secondary', onClick: handleCancel }, 'Cancel')
                    )
                )
                : React.createElement(
                    'div',
                    { className: 'office-display-block' },
                    React.createElement('p', { className: 'office-display-text' }, mission || React.createElement('em', { className: 'office-empty-hint' }, 'No mission statement set yet.'))
                ),
            React.createElement(StatusMsg, status)
        )
    );
}

// ─── SPDMS-207: Vision Section ────────────────────────────────────────────────

function VisionSection({ vision, onSave }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(vision);
    const [error, setError] = useState('');
    const [status, setStatus] = useState({ message: '', type: 'info' });

    useEffect(() => {
        if (!editing) setValue(vision);
    }, [vision, editing]);

    function handleSave() {
        if (!value.trim()) { setError('Vision statement cannot be empty.'); return; }
        setError('');
        onSave('vision', value.trim());
        setEditing(false);
        setStatus({ message: 'Vision saved successfully.', type: 'success' });
        setTimeout(() => setStatus({ message: '', type: 'info' }), 3000);
    }

    function handleCancel() { setValue(vision); setError(''); setEditing(false); }

    return React.createElement(
        'div',
        { className: 'task-card shadow-sm' },
        React.createElement(
            'div',
            { className: 'task-card-header' },
            React.createElement(
                'h5',
                { className: 'task-card-title' },
                React.createElement(
                    'span',
                    { className: 'task-card-icon icon-vision' },
                    React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                        React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' }),
                        React.createElement('circle', { cx: '12', cy: '12', r: '3' })
                    )
                ),
                'Vision Statement'
            ),
            !editing && React.createElement(
                'button',
                { className: 'office-btn office-btn-primary', onClick: () => { setValue(vision); setEditing(true); } },
                React.createElement('i', { className: 'bi bi-pencil me-1' }),
                'Update'
            )
        ),
        React.createElement('p', { className: 'task-card-subtitle' }, 'Describe the long-term aspirations and desired future state of your organisation.'),
        React.createElement(
            'div',
            { className: 'task-card-body' },
            editing
                ? React.createElement(
                    React.Fragment, null,
                    React.createElement(
                        'div',
                        { className: `office-field-group${error ? ' has-error' : ''}` },
                        React.createElement('label', { className: 'office-label', htmlFor: 'vision-input' }, 'Vision Statement', React.createElement('span', { className: 'required-mark' }, '*')),
                        React.createElement('textarea', {
                            id: 'vision-input',
                            className: 'office-textarea',
                            value,
                            rows: 4,
                            placeholder: "Enter your organisation's vision statement...",
                            onChange: (e) => { setValue(e.target.value); setError(''); },
                        }),
                        error && React.createElement('p', { className: 'office-field-error' }, error)
                    ),
                    React.createElement(
                        'div',
                        { className: 'office-actions' },
                        React.createElement('button', { className: 'office-btn office-btn-primary', onClick: handleSave }, React.createElement('i', { className: 'bi bi-check-lg me-1' }), 'Save Vision'),
                        React.createElement('button', { className: 'office-btn office-btn-secondary', onClick: handleCancel }, 'Cancel')
                    )
                )
                : React.createElement(
                    'div',
                    { className: 'office-display-block' },
                    React.createElement('p', { className: 'office-display-text' }, vision || React.createElement('em', { className: 'office-empty-hint' }, 'No vision statement set yet.'))
                ),
            React.createElement(StatusMsg, status)
        )
    );
}

// ─── SPDMS-208 + 209: Core Value Row ─────────────────────────────────────────

function CoreValueRow({ value, onUpdate, onDelete }) {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(value.title);
    const [description, setDescription] = useState(value.description);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!editing) { setTitle(value.title); setDescription(value.description); }
    }, [value.title, value.description, editing]);

    function validate() {
        const e = {};
        if (!title.trim()) e.title = 'Title cannot be empty.';
        if (!description.trim()) e.description = 'Description cannot be empty.';
        return e;
    }

    function handleSave() {
        const e = validate();
        if (Object.keys(e).length > 0) { setErrors(e); return; }
        setErrors({});
        onUpdate(value.id, { title: title.trim(), description: description.trim() });
        setEditing(false);
    }

    function handleCancel() { setTitle(value.title); setDescription(value.description); setErrors({}); setEditing(false); }

    if (editing) {
        return React.createElement(
            'li',
            { className: 'cv-item cv-item--editing' },
            React.createElement(
                'div',
                { className: 'cv-edit-grid' },
                React.createElement(
                    'div',
                    { className: `office-field-group${errors.title ? ' has-error' : ''}` },
                    React.createElement('label', { className: 'office-label', htmlFor: `cv-title-${value.id}` }, 'Title', React.createElement('span', { className: 'required-mark' }, '*')),
                    React.createElement('input', { id: `cv-title-${value.id}`, className: 'office-input', type: 'text', value: title, placeholder: 'e.g. Integrity', onChange: (e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: '' })); } }),
                    errors.title && React.createElement('p', { className: 'office-field-error' }, errors.title)
                ),
                React.createElement(
                    'div',
                    { className: `office-field-group${errors.description ? ' has-error' : ''}` },
                    React.createElement('label', { className: 'office-label', htmlFor: `cv-desc-${value.id}` }, 'Description', React.createElement('span', { className: 'required-mark' }, '*')),
                    React.createElement('textarea', { id: `cv-desc-${value.id}`, className: 'office-textarea office-textarea--sm', value: description, rows: 2, placeholder: 'Describe this core value...', onChange: (e) => { setDescription(e.target.value); setErrors((p) => ({ ...p, description: '' })); } }),
                    errors.description && React.createElement('p', { className: 'office-field-error' }, errors.description)
                )
            ),
            React.createElement(
                'div',
                { className: 'office-actions mt-1' },
                React.createElement('button', { className: 'office-btn office-btn-primary', onClick: handleSave }, React.createElement('i', { className: 'bi bi-check-lg me-1' }), 'Save'),
                React.createElement('button', { className: 'office-btn office-btn-secondary', onClick: handleCancel }, 'Cancel')
            )
        );
    }

    return React.createElement(
        'li',
        { className: 'cv-item' },
        React.createElement(
            'div',
            { className: 'cv-item-content' },
            React.createElement('div', { className: 'cv-badge' }, value.title.charAt(0).toUpperCase()),
            React.createElement(
                'div',
                { className: 'cv-item-text' },
                React.createElement('h6', { className: 'cv-item-title' }, value.title),
                React.createElement('p', { className: 'cv-item-description' }, value.description)
            )
        ),
        React.createElement(
            'div',
            { className: 'cv-item-actions' },
            React.createElement('button', { className: 'office-btn office-btn-secondary', onClick: () => setEditing(true) }, React.createElement('i', { className: 'bi bi-pencil' }), ' Edit'),
            React.createElement('button', { className: 'office-btn office-btn-danger', onClick: () => onDelete(value.id) }, React.createElement('i', { className: 'bi bi-trash' }), ' Delete')
        )
    );
}

// ─── SPDMS-208: Core Values Section ──────────────────────────────────────────

function CoreValuesSection({ coreValues, onAdd, onUpdate, onDelete }) {
    const [showForm, setShowForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [errors, setErrors] = useState({});
    const [status, setStatus] = useState({ message: '', type: 'info' });

    function validate() {
        const e = {};
        if (!newTitle.trim()) e.title = 'Title cannot be empty.';
        if (!newDesc.trim()) e.description = 'Description cannot be empty.';
        return e;
    }

    function handleAdd() {
        const e = validate();
        if (Object.keys(e).length > 0) { setErrors(e); return; }
        setErrors({});
        onAdd({ title: newTitle.trim(), description: newDesc.trim() });
        setNewTitle(''); setNewDesc(''); setShowForm(false);
        setStatus({ message: 'Core value added successfully.', type: 'success' });
        setTimeout(() => setStatus({ message: '', type: 'info' }), 3000);
    }

    function handleDelete(id) {
        if (!window.confirm('Delete this core value?')) return;
        onDelete(id);
        setStatus({ message: 'Core value removed.', type: 'success' });
        setTimeout(() => setStatus({ message: '', type: 'info' }), 3000);
    }

    return React.createElement(
        'div',
        { className: 'task-card shadow-sm' },
        React.createElement(
            'div',
            { className: 'task-card-header' },
            React.createElement(
                'h5',
                { className: 'task-card-title' },
                React.createElement(
                    'span',
                    { className: 'task-card-icon icon-values' },
                    React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
                        React.createElement('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' })
                    )
                ),
                'Core Values'
            ),
            React.createElement(
                'button',
                { className: 'office-btn office-btn-primary', onClick: () => setShowForm(true) },
                React.createElement('i', { className: 'bi bi-plus-lg me-1' }),
                'Add Value'
            )
        ),
        React.createElement('p', { className: 'task-card-subtitle' }, "Define the guiding principles that shape your organisation's culture and decisions."),
        React.createElement(
            'div',
            { className: 'task-card-body' },
            coreValues.length === 0
                ? React.createElement('div', { className: 'office-empty-state' }, 'No core values added yet. Click "Add Value" to get started.')
                : React.createElement(
                    'ul',
                    { className: 'cv-list' },
                    coreValues.map((cv) =>
                        React.createElement(CoreValueRow, {
                            key: cv.id,
                            value: cv,
                            onUpdate: (id, updated) => {
                                onUpdate(id, updated);
                                setStatus({ message: 'Core value updated.', type: 'success' });
                                setTimeout(() => setStatus({ message: '', type: 'info' }), 3000);
                            },
                            onDelete: handleDelete,
                        })
                    )
                ),
            showForm && React.createElement(
                'div',
                { className: 'office-add-form mt-2' },
                React.createElement('p', { className: 'office-add-form-title' }, 'Add New Core Value'),
                React.createElement(
                    'div',
                    { className: 'cv-edit-grid' },
                    React.createElement(
                        'div',
                        { className: `office-field-group${errors.title ? ' has-error' : ''}` },
                        React.createElement('label', { className: 'office-label', htmlFor: 'cv-new-title' }, 'Title', React.createElement('span', { className: 'required-mark' }, '*')),
                        React.createElement('input', { id: 'cv-new-title', className: 'office-input', type: 'text', value: newTitle, placeholder: 'e.g. Integrity', autoFocus: true, onChange: (e) => { setNewTitle(e.target.value); setErrors((p) => ({ ...p, title: '' })); } }),
                        errors.title && React.createElement('p', { className: 'office-field-error', role: 'alert' }, errors.title)
                    ),
                    React.createElement(
                        'div',
                        { className: `office-field-group${errors.description ? ' has-error' : ''}` },
                        React.createElement('label', { className: 'office-label', htmlFor: 'cv-new-desc' }, 'Description', React.createElement('span', { className: 'required-mark' }, '*')),
                        React.createElement('textarea', { id: 'cv-new-desc', className: 'office-textarea office-textarea--sm', value: newDesc, rows: 2, placeholder: 'Describe this core value...', onChange: (e) => { setNewDesc(e.target.value); setErrors((p) => ({ ...p, description: '' })); } }),
                        errors.description && React.createElement('p', { className: 'office-field-error', role: 'alert' }, errors.description)
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'office-actions mt-1' },
                    React.createElement('button', { className: 'office-btn office-btn-primary', onClick: handleAdd }, React.createElement('i', { className: 'bi bi-plus-lg me-1' }), 'Add Core Value'),
                    React.createElement('button', { className: 'office-btn office-btn-secondary', onClick: () => { setShowForm(false); setErrors({}); setNewTitle(''); setNewDesc(''); } }, 'Cancel')
                )
            ),
            React.createElement(StatusMsg, status)
        )
    );
}

// ─── SPDMS-205: Main App ──────────────────────────────────────────────────────

function StrategicPlanApp() {
    const [collapsed, setCollapsed] = useState(false);
    const [mission, setMission] = useState(STATIC_DATA.mission);
    const [vision, setVision] = useState(STATIC_DATA.vision);
    const [coreValues, setCoreValues] = useState(STATIC_DATA.coreValues);
    const [nextId, setNextId] = useState(STATIC_DATA.coreValues.length + 1);

    function handleLogout() {
        fetch('/api/logout', { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } })
            .catch(() => null)
            .finally(() => { window.location.href = loginUrl; });
    }

    function handleSaveFoundation(field, value) {
        if (field === 'mission') setMission(value);
        if (field === 'vision') setVision(value);
    }

    function handleAddCoreValue(newVal) {
        setCoreValues((prev) => [...prev, { id: nextId, ...newVal }]);
        setNextId((n) => n + 1);
    }

    function handleUpdateCoreValue(id, updated) {
        setCoreValues((prev) => prev.map((cv) => (cv.id === id ? { ...cv, ...updated } : cv)));
    }

    function handleDeleteCoreValue(id) {
        setCoreValues((prev) => prev.filter((cv) => cv.id !== id));
    }

    return React.createElement(
        React.Fragment,
        null,
        // Sidebar
        React.createElement(Sidebar, { collapsed, onToggle: () => setCollapsed((c) => !c) }),
        // Main content
        React.createElement(
            'div',
            { className: `main-content${collapsed ? ' expanded' : ''}`, id: 'mainContent' },
            React.createElement(TopBar, { onLogout: handleLogout }),
            React.createElement(
                'div',
                { className: 'office-page-header' },
                React.createElement(
                    'div',
                    null,
                    React.createElement('h3', { className: 'office-page-title' }, 'Strategic Plan'),
                    React.createElement('p', { className: 'office-page-subtitle' }, "Manage your organisation's Mission, Vision, and Core Values.")
                ),
                React.createElement(
                    'a',
                    { href: dashboardUrl, className: 'office-btn office-btn-secondary' },
                    React.createElement('i', { className: 'bi bi-arrow-left me-1' }),
                    'Back to Dashboard'
                )
            ),
            // Mission
            React.createElement(MissionSection, { mission, onSave: handleSaveFoundation }),
            // Vision
            React.createElement('div', { style: { marginTop: '16px' } },
                React.createElement(VisionSection, { vision, onSave: handleSaveFoundation })
            ),
            // Core Values
            React.createElement('div', { style: { marginTop: '16px' } },
                React.createElement(CoreValuesSection, {
                    coreValues,
                    onAdd: handleAddCoreValue,
                    onUpdate: handleUpdateCoreValue,
                    onDelete: handleDeleteCoreValue,
                })
            )
        )
    );
}

ReactDOM.createRoot(rootElement).render(React.createElement(StrategicPlanApp));
