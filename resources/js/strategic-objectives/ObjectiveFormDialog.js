const { useEffect, useState } = React;

const emptyObjective = { objective_title: '', objective_description: '', expected_outcome: '', indicator: '' };
const emptyErrors = {};
const emptyPlans = [];

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
    plans = emptyPlans,
    requirePlan = false,
    selectedPlanId = '',
    readOnly = false,
    onSave,
    onClose,
}) {
    const [form, setForm] = useState(emptyObjective);
    const [errors, setErrors] = useState({});
    const [planId, setPlanId] = useState('');
    const selectablePlans = plans.filter((plan) => !['archived', 'deleted'].includes(plan.status));
    const selectPlan = requirePlan && !objective && !readOnly;

    useEffect(() => {
        if (!open) return;
        setForm(Object.fromEntries(Object.keys(emptyObjective).map((key) => [key, objective?.[key] ?? ''])));
        setPlanId(String(selectedPlanId ?? ''));
        setErrors({});
    }, [open, objective, selectedPlanId]);
    useEffect(() => { setErrors((current) => ({ ...current, ...serverErrors })); }, [serverErrors]);

    if (!open) return null;

    function change(event) { const { name, value } = event.target; setForm((current) => ({ ...current, [name]: value })); setErrors((current) => ({ ...current, [name]: '' })); }
    function submit() {
        if (readOnly || submitting) return;
        const next = {};
        if (!form.objective_title.trim()) next.objective_title = 'Strategic Objective is required.';
        if (!form.expected_outcome.trim()) next.expected_outcome = 'Expected Outcome is required.';
        if (selectPlan && !selectablePlans.some((plan) => String(plan.record_id) === planId)) {
            next.strategic_plan_id = 'Select an available Strategic Plan.';
        }
        setErrors(next);
        if (Object.keys(next).length) return;
        const payload = Object.fromEntries(Object.keys(emptyObjective).map((key) => [key, form[key]]));
        if (selectPlan) payload.strategic_plan_id = Number(planId);
        onSave(payload);
    }

    return React.createElement('div', { className: 'objective-modal-backdrop' },
        React.createElement('section', { className: 'objective-modal ui-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'objective-dialog-title', onKeyDown: (event) => { if (event.key === 'Escape' && !submitting) onClose(); } },
            React.createElement('div', { className: 'objective-modal__header' }, React.createElement('h2', { id: 'objective-dialog-title' }, readOnly ? 'Review Strategic Objective' : (objective ? 'Update Strategic Objective' : 'Add Strategic Objective')), React.createElement('button', { type: 'button', onClick: onClose, disabled: submitting, 'aria-label': 'Close objective form' }, '×')),
            React.createElement(
    'div',
    { className: 'objective-modal__body ui-form-grid' },

    submitError ? React.createElement('p', { className: 'ui-error', role: 'alert' }, submitError) : null,

    selectPlan ? React.createElement('div', { className: `ui-field${errors.strategic_plan_id ? ' is-invalid' : ''}` },
        React.createElement('label', { className: 'ui-label', htmlFor: 'objective-strategic-plan' }, 'Strategic Plan', React.createElement('span', { className: 'ui-required' }, ' *')),
        React.createElement('select', {
            id: 'objective-strategic-plan',
            name: 'strategic_plan_id',
            className: 'ui-input',
            value: planId,
            required: true,
            disabled: submitting,
            'aria-invalid': Boolean(errors.strategic_plan_id),
            onChange: (event) => {
                setPlanId(event.target.value);
                setErrors((current) => ({ ...current, strategic_plan_id: '' }));
            },
        },
        React.createElement('option', { value: '', disabled: true }, 'Select a Strategic Plan'),
        selectablePlans.map((plan) => React.createElement('option', { key: plan.record_id, value: String(plan.record_id) }, `${plan.title || 'Untitled Strategic Plan'} (#${plan.record_id})`))),
        errors.strategic_plan_id ? React.createElement('p', { className: 'ui-error', role: 'alert' }, Array.isArray(errors.strategic_plan_id) ? errors.strategic_plan_id[0] : errors.strategic_plan_id) : null,
        !selectablePlans.length ? React.createElement('p', null, 'No available Strategic Plans.') : null
    ) : null,

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
        readOnly ? React.createElement(ObjectiveField, {
            label: 'Responsible Office/Agency',
            name: 'responsible_office_agency',
            value: objective?.responsible_office_agency || 'Unassigned',
            disabled: true,
        }) : null
),
            React.createElement('div', { className: 'objective-modal__actions' }, React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: onClose, disabled: submitting }, readOnly ? 'Close' : 'Cancel'), readOnly ? null : React.createElement('button', { className: 'ui-button ui-button--primary', type: 'button', onClick: submit, disabled: submitting || (selectPlan && !selectablePlans.length) }, submitting ? 'Saving…' : (objective ? 'Save Changes' : 'Add Objective')))
        )
    );
}
