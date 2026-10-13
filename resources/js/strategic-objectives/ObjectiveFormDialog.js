const { useEffect, useState } = React;

const emptyObjective = { objective_title: '', objective_description: '', expected_outcome: '', indicator: '', target: '', responsible_office_agency: '' };
const emptyErrors = {};

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
    disabled = false,
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
        disabled,
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
    serverErrors = emptyErrors,
    submitError = '',
    planLabel = '',
    readOnly = false,
    availableUnits = [],
    onSave,
    onClose,
}) {
    const [form, setForm] = useState(emptyObjective);
    const [errors, setErrors] = useState({});
    useEffect(() => {
        if (!open) return;
        setForm(Object.fromEntries(Object.keys(emptyObjective).map((key) => [key, objective?.[key] ?? ''])));
        setErrors({});
    }, [open, objective]);
    useEffect(() => { setErrors((current) => ({ ...current, ...serverErrors })); }, [serverErrors]);

    if (!open) return null;

    function change(event) { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })); setErrors((current) => ({ ...current, [name]: '' })); }
    function submit() {
        if (readOnly || submitting) return;
        const next = {};
        if (!form.objective_title.trim()) next.objective_title = 'Strategic Objective is required.';
        if (!form.expected_outcome.trim()) next.expected_outcome = 'Expected Outcome is required.';
        setErrors(next);
        if (Object.keys(next).length) return;
        const payload = Object.fromEntries(Object.keys(emptyObjective).map((key) => [key, form[key]]));
        onSave(payload);
    }

    return React.createElement('div', { className: 'objective-modal-backdrop' },
        React.createElement('section', { className: 'objective-modal ui-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'objective-dialog-title', onKeyDown: (event) => { if (event.key === 'Escape' && !submitting) onClose(); } },
            planLabel && React.createElement('p', { className: 'ui-status ui-status--info' }, 'Strategic Plan: ', planLabel),
            React.createElement('div', { className: 'objective-modal__header' }, React.createElement('h2', { id: 'objective-dialog-title' }, readOnly ? 'Review Strategic Objective' : (objective ? 'Update Strategic Objective' : 'Add Strategic Objective')), React.createElement('button', { type: 'button', onClick: onClose, disabled: submitting, 'aria-label': 'Close objective form' }, '×')),
            React.createElement(
    'div',
    { className: 'objective-modal__body ui-form-grid' },

    submitError ? React.createElement('p', { className: 'ui-error', role: 'alert' }, submitError) : null,

    React.createElement(ObjectiveField, {
        label: 'Strategic Objective',
        name: 'objective_title',
        value: form.objective_title,
        onChange: change,
        error: errors.objective_title,
        textarea: true,
        required: true,
        disabled: readOnly || submitting,
        placeholder: 'Describe the high-level objective',
    }),

    React.createElement(ObjectiveField, {
        label: 'Objective Details',
        name: 'objective_description',
        value: form.objective_description,
        onChange: change,
        error: errors.objective_description,
        textarea: true,
        disabled: readOnly || submitting,
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
        disabled: readOnly || submitting,
        placeholder: 'Describe the expected result',
    }),

        React.createElement(ObjectiveField, {
            label: 'Indicator',
            name: 'indicator',
            value: form.indicator,
            onChange: change,
            error: errors.indicator,
            textarea: true,
            disabled: readOnly || submitting,
            placeholder: 'How progress will be measured',
        }),
        React.createElement(ObjectiveField, {
            label: 'Target', name: 'target', value: form.target, onChange: change, error: errors.target,
            disabled: readOnly || submitting, placeholder: 'e.g. 50 projects by 2032',
        }),
        React.createElement('div', { className: 'ui-field' },
    React.createElement('label', {
        className: 'ui-label',
        htmlFor: 'objective-responsible-office',
    }, 'Responsible Office/Unit'),

    React.createElement('select', {
        id: 'objective-responsible-office',
        name: 'responsible_office_agency',
        className: 'ui-select',
        value: form.responsible_office_agency,
        onChange: change,
        disabled: readOnly || submitting || availableUnits.length === 0,
        'aria-invalid': Boolean(errors.responsible_office_agency),
    },
        React.createElement('option', { value: '' }, 'Unassigned'),
        form.responsible_office_agency
            && !availableUnits.some(unit =>
                unit.responsible_office_agency === form.responsible_office_agency
            )
            && React.createElement('option', {
                value: form.responsible_office_agency,
                disabled: true,
            }, `${form.responsible_office_agency} (currently unavailable)`),
        availableUnits.map(unit => React.createElement('option', {
            key: unit.responsible_unit_id,
            value: unit.responsible_office_agency,
        }, unit.responsible_office_agency))
    ),

    React.createElement('small', { className: 'ui-help' },
        'Select the Office/Unit responsible for this objective.'),

    errors.responsible_office_agency && React.createElement('p', {
        className: 'ui-error',
        role: 'alert',
    }, Array.isArray(errors.responsible_office_agency)
        ? errors.responsible_office_agency[0]
        : errors.responsible_office_agency)
)
),
            React.createElement('div', { className: 'objective-modal__actions' }, React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: onClose, disabled: submitting }, readOnly ? 'Close' : 'Cancel'), readOnly ? null : React.createElement('button', { className: 'ui-button ui-button--primary', type: 'button', onClick: submit, disabled: submitting }, submitting ? 'Saving…' : (objective ? 'Save Changes' : 'Add Objective')))
        )
    );
}
