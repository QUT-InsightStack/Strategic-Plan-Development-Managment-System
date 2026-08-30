const { useEffect, useState } = React;

const emptyForm = { title: '', level: 'strategic_plan', planning_start_date: '', planning_end_date: '', department_agency: '', mission: '', vision: '', description: '' };

function Field({ label, name, value, onChange, error, type = 'text', placeholder = '', required = false }) {
    return React.createElement('div', { className: `ui-field${error ? ' is-invalid' : ''}` },
        React.createElement('label', { className: 'ui-label', htmlFor: name }, label, required ? React.createElement('span', { className: 'ui-required' }, ' *') : null),
        React.createElement('input', { className: 'ui-input', id: name, name, type, value, placeholder, onChange, 'aria-invalid': Boolean(error) }),
        error ? React.createElement('p', { className: 'ui-error', role: 'alert' }, Array.isArray(error) ? error[0] : error) : null
    );
}

function TextArea({ label, name, value, onChange, error, placeholder, required = false, rows = 3 }) {
    return React.createElement('div', { className: `ui-field${error ? ' is-invalid' : ''}` },
        React.createElement('label', { className: 'ui-label', htmlFor: name }, label, required ? React.createElement('span', { className: 'ui-required' }, ' *') : null),
        React.createElement('textarea', { className: 'ui-textarea', id: name, name, value, rows, placeholder, onChange, 'aria-invalid': Boolean(error) }),
        error ? React.createElement('p', { className: 'ui-error', role: 'alert' }, Array.isArray(error) ? error[0] : error) : null
    );
}

export function PlanStructurePanel() {
    const items = [
        ['bi-bullseye', 'Foundation', 'Mission, Vision, Core Values', 'green'], ['bi-flag-fill', 'Strategic Objectives', 'High-level goals that the plan aims to achieve.', 'purple'],
        ['bi-bank2', 'Inputs from Offices/Agencies', 'Comments, proposed objectives, and assigned updates.', 'blue'], ['bi-speedometer2', 'Indicators', 'Measures used to track progress and achievement.', 'cyan'],
        ['bi-bar-chart-fill', 'Alignment Mapping', 'Links objectives to higher-level plans and priorities.', 'orange'], ['bi-file-earmark-check-fill', 'Review & Submit', 'Review details, confirm mappings, and submit.', 'pink'],
    ];
    return React.createElement('aside', { className: 'structure-card', 'aria-labelledby': 'structure-title' },
        React.createElement('h2', { id: 'structure-title' }, 'Plan structure'), React.createElement('p', null, 'A strategic plan is composed of the following elements'),
        React.createElement('div', { className: 'structure-list' }, items.map(([icon, title, description, tone]) => React.createElement('div', { className: `structure-item ${tone}`, key: title }, React.createElement('i', { className: `bi ${icon}` }), React.createElement('span', null, React.createElement('strong', null, title), React.createElement('small', null, description)))))
    );
}

export function StrategicPlanForm({ initialData = null, mode = 'create', onSubmit, submitting = false, serverErrors = {} }) {
    const [form, setForm] = useState(emptyForm);
    const [coreValues, setCoreValues] = useState([]);
    const [newCoreValue, setNewCoreValue] = useState('');
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!initialData) return;
        setForm({
            ...emptyForm,
            title: initialData.title || '',
            level: initialData.level || 'strategic_plan',
            planning_start_date: initialData.planning_start_date || '',
            planning_end_date: initialData.planning_end_date || '',
            department_agency: initialData.department_agency || '',
            description: initialData.description || '',
            mission:
                initialData.missionFoundation?.content ||
                initialData.mission_foundation?.content ||
                '',
            vision:
                initialData.visionFoundation?.content ||
                initialData.vision_foundation?.content ||
                '',
        });
        setCoreValues((initialData.coreValues || initialData.core_values || []).map((value) => value.content || value));
    }, [initialData]);

    useEffect(() => { setErrors((current) => ({ ...current, ...serverErrors })); }, [serverErrors]);

    function updateField(event) { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })); setErrors((current) => ({ ...current, [name]: '' })); }
    function addCoreValue() {
        const value = newCoreValue.trim();
        if (!value) return setErrors((current) => ({ ...current, core_values: 'Enter a core value before adding it.' }));
        if (coreValues.some((item) => item.toLowerCase() === value.toLowerCase())) return setErrors((current) => ({ ...current, core_values: 'This core value has already been added.' }));
        setCoreValues((current) => [...current, value]); setNewCoreValue(''); setErrors((current) => ({ ...current, core_values: '' }));
    }
    function validate(status) {
        const next = {};
        if (status !== 'draft') {
            if (!form.title.trim()) next.title = 'Plan title is required.';
            if (!form.mission.trim()) next.mission = 'Mission is required.';
            if (!form.vision.trim()) next.vision = 'Vision is required.';
            if (!coreValues.length) next.core_values = 'Add at least one core value.';
        }
        if (form.planning_start_date && form.planning_end_date && form.planning_end_date < form.planning_start_date) next.planning_end_date = 'End date must be on or after the start date.';
        setErrors(next); return Object.keys(next).length === 0;
    }
    function submit(status, goNext = false) {
        if (!validate(status)) return;
        onSubmit({ ...form, title: form.title.trim(), mission: form.mission.trim(), vision: form.vision.trim(), description: form.description.trim() || null, department_agency: form.department_agency.trim() || null, core_values: coreValues, status }, goNext);
    }
const saveStatus =
    mode === 'edit'
        ? initialData?.status || 'draft'
        : 'draft';

    return React.createElement('div', { className: 'create-plan-layout' },
        React.createElement('form', { className: 'plan-form-card', onSubmit: (event) => event.preventDefault(), noValidate: true },
            React.createElement('section', { className: 'plan-section' }, React.createElement('h2', null, React.createElement('span', null, '1.'), ' Basic Information'),
                React.createElement(Field, { label: 'Plan Title', name: 'title', value: form.title, onChange: updateField, error: errors.title, placeholder: 'Enter the plan title', required: true }),
                React.createElement('div', { className: 'plan-two-columns' },
                    React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'level' }, 'Strategic Plan Level', React.createElement('span', { className: 'ui-required' }, ' *')), React.createElement('select', { className: 'ui-select', id: 'level', name: 'level', value: form.level, onChange: updateField }, React.createElement('option', { value: 'strategic_plan' }, 'Strategic Plan'), React.createElement('option', { value: 'goal' }, 'Goal'))),
                    React.createElement('div', { className: 'plan-period' }, React.createElement(Field, { label: 'Planning Period — Start', name: 'planning_start_date', type: 'date', value: form.planning_start_date, onChange: updateField, error: errors.planning_start_date }), React.createElement(Field, { label: 'End', name: 'planning_end_date', type: 'date', value: form.planning_end_date, onChange: updateField, error: errors.planning_end_date }))
                ),
                React.createElement(Field, { label: 'Department/Agency', name: 'department_agency', value: form.department_agency, onChange: updateField, error: errors.department_agency, placeholder: 'Enter department or agency' })
            ),
            React.createElement('section', { className: 'plan-section' }, React.createElement('h2', null, React.createElement('span', null, '2.'), ' Strategic Foundation'),
                React.createElement(TextArea, { label: 'Mission', name: 'mission', value: form.mission, onChange: updateField, error: errors.mission, placeholder: 'Input your mission', required: true }),
                React.createElement(TextArea, { label: 'Vision', name: 'vision', value: form.vision, onChange: updateField, error: errors.vision, placeholder: 'Input your vision', required: true }),
                React.createElement('div', { className: `ui-field${errors.core_values ? ' is-invalid' : ''}` }, React.createElement('label', { className: 'ui-label', htmlFor: 'new-core-value' }, 'Core Values', React.createElement('span', { className: 'ui-required' }, ' *')),
                    coreValues.length ? React.createElement('div', { className: 'core-value-chips' }, coreValues.map((value, index) => React.createElement('span', { className: `core-value-chip tone-${index % 4}`, key: `${value}-${index}` }, value, React.createElement('button', { type: 'button', onClick: () => setCoreValues((current) => current.filter((_, itemIndex) => itemIndex !== index)), 'aria-label': `Remove ${value}` }, '×')))) : null,
                    React.createElement('div', { className: 'core-value-entry' }, React.createElement('input', { className: 'ui-input', id: 'new-core-value', value: newCoreValue, placeholder: 'Enter a core value', onChange: (event) => setNewCoreValue(event.target.value), onKeyDown: (event) => { if (event.key === 'Enter') { event.preventDefault(); addCoreValue(); } } }), React.createElement('button', { type: 'button', className: 'ui-button ui-button--secondary', onClick: addCoreValue }, '+ Add Value')),
                    errors.core_values ? React.createElement('p', { className: 'ui-error', role: 'alert' }, Array.isArray(errors.core_values) ? errors.core_values[0] : errors.core_values) : null)
                ),
            React.createElement('section', { className: 'plan-section' }, React.createElement('h2', null, React.createElement('span', null, '3.'), ' Description/Notes'), React.createElement(TextArea, { label: 'Description or notes', name: 'description', value: form.description, onChange: updateField, error: errors.description, placeholder: 'Input description or notes for this plan' })),
            React.createElement(
    'div',
    { className: 'plan-form-actions' },

    React.createElement(
        'a',
        {
            className: 'ui-button ui-button--secondary',
            href: '/strategic-plans',
        },
        'Cancel'
    ),

    mode === 'create'
        ? React.createElement(
            'button',
            {
                type: 'button',
                className: 'ui-button ui-button--secondary',
                onClick: () => submit('draft', false),
                disabled: submitting,
            },
            'Save as Draft'
        )
        : React.createElement(
            'button',
            {
                type: 'button',
                className: 'ui-button ui-button--secondary',
                onClick: () => submit(saveStatus, false),
                disabled: submitting,
            },
            'Save Changes'
        ),

    React.createElement(
        'button',
        {
            type: 'button',
            className: 'ui-button ui-button--primary',
            onClick: () => submit(saveStatus, true),
            disabled: submitting,
        },
        mode === 'create'
            ? 'Next: Add Objectives'
            : 'Save & Continue: Objectives'
    )
)
        ), React.createElement(PlanStructurePanel)
    );
}
