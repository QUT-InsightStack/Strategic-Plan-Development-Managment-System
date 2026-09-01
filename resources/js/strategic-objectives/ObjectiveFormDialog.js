const { useEffect, useState } = React;

const emptyObjective = { objective_title: '', objective_description: '', expected_outcome: '', indicator: '', target: '', responsible_office_agency: '' };

function ObjectiveField({
    label,
    name,
    value,
    onChange,
    error,
    textarea = false,
    required = false,
    placeholder = '',
    suggestions = [],
}) {
    const listId = suggestions.length
        ? `objective-${name}-suggestions`
        : undefined;

    const controlProps = {
        className: textarea ? 'ui-textarea' : 'ui-input',
        id: `objective-${name}`,
        name,
        value,
        onChange,
        placeholder,
        list: listId,
        'aria-invalid': Boolean(error),
    };

    return React.createElement(
        'div',
        { className: `ui-field${error ? ' is-invalid' : ''}` },

        React.createElement(
            'label',
            {
                className: 'ui-label',
                htmlFor: `objective-${name}`,
            },
            label,
            required
                ? React.createElement(
                    'span',
                    { className: 'ui-required' },
                    ' *'
                )
                : null
        ),

        textarea
            ? React.createElement('textarea', {
                ...controlProps,
                rows: 3,
            })
            : React.createElement('input', controlProps),

        listId
            ? React.createElement(
                'datalist',
                { id: listId },
                suggestions.map((suggestion) =>
                    React.createElement('option', {
                        key: suggestion,
                        value: suggestion,
                    })
                )
            )
            : null,

        error
            ? React.createElement(
                'p',
                {
                    className: 'ui-error',
                    role: 'alert',
                },
                Array.isArray(error) ? error[0] : error
            )
            : null
    );
}

export function ObjectiveFormDialog({
    open,
    objective = null,
    submitting = false,
    serverErrors = {},
    officeSuggestions = [],
    onSave,
    onClose,
}) {
    const [form, setForm] = useState(emptyObjective);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (!open) return;
        setForm(objective ? { ...emptyObjective, ...objective } : emptyObjective);
        setErrors({});
    }, [open, objective]);
    useEffect(() => { setErrors((current) => ({ ...current, ...serverErrors })); }, [serverErrors]);

    if (!open) return null;

    function change(event) { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })); setErrors((current) => ({ ...current, [name]: '' })); }
    function submit() {
        const next = {};
        if (!form.objective_title.trim()) next.objective_title = 'Strategic Objective is required.';
        if (!form.expected_outcome.trim()) next.expected_outcome = 'Expected Outcome is required.';
        if (!form.target.trim()) next.target = 'Target is required.';
        if (!form.responsible_office_agency.trim()) next.responsible_office_agency = 'Responsible Office/Agency is required.';
        setErrors(next);
        if (Object.keys(next).length) return;
        onSave({ ...form, status: 'draft' });
    }

    return React.createElement('div', { className: 'objective-modal-backdrop' },
        React.createElement('section', { className: 'objective-modal ui-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'objective-dialog-title' },
            React.createElement('div', { className: 'objective-modal__header' }, React.createElement('h2', { id: 'objective-dialog-title' }, objective ? 'Update Strategic Objective' : 'Add Strategic Objective'), React.createElement('button', { type: 'button', onClick: onClose, 'aria-label': 'Close objective form' }, '×')),
            React.createElement(
    'div',
    { className: 'objective-modal__body ui-form-grid' },

    React.createElement(ObjectiveField, {
        label: 'Strategic Objective',
        name: 'objective_title',
        value: form.objective_title,
        onChange: change,
        error: errors.objective_title,
        textarea: true,
        required: true,
        placeholder: 'Describe the high-level objective',
    }),

    React.createElement(ObjectiveField, {
        label: 'Objective Details',
        name: 'objective_description',
        value: form.objective_description,
        onChange: change,
        error: errors.objective_description,
        textarea: true,
        placeholder: 'Add supporting details (optional)',
    }),

    React.createElement(ObjectiveField, {
        label: 'Expected Outcome',
        name: 'expected_outcome',
        value: form.expected_outcome,
        onChange: change,
        error: errors.expected_outcome,
        textarea: true,
        required: true,
        placeholder: 'Describe the expected result',
    }),

    React.createElement(
        'div',
        { className: 'ui-form-grid ui-form-grid--2' },

        React.createElement(ObjectiveField, {
            label: 'Indicator',
            name: 'indicator',
            value: form.indicator,
            onChange: change,
            error: errors.indicator,
            textarea: true,
            placeholder: 'How progress will be measured',
        }),

        React.createElement(ObjectiveField, {
            label: 'Target',
            name: 'target',
            value: form.target,
            onChange: change,
            error: errors.target,
            required: true,
            placeholder: 'e.g. 50 projects by 2032',
        })
    ),

    React.createElement(ObjectiveField, {
        label: 'Responsible Office/Agency',
        name: 'responsible_office_agency',
        value: form.responsible_office_agency,
        onChange: change,
        error: errors.responsible_office_agency,
        required: true,
        placeholder: 'Select or enter an office/agency',
        suggestions: officeSuggestions,
    })
),
            React.createElement('div', { className: 'objective-modal__actions' }, React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: onClose, disabled: submitting }, 'Cancel'), React.createElement('button', { className: 'ui-button ui-button--primary', type: 'button', onClick: submit, disabled: submitting }, objective ? 'Save Changes' : 'Add Objective'))
        )
    );
}
