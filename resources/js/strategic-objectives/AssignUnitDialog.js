const { useEffect, useState } = React;

export function AssignUnitDialog({
    objective = null,
    submitting = false,
    error = '',
    onAssign,
    onClose,
    availableUnits = [],
}) {
    const [selectedUnit, setSelectedUnit] = useState('');

    useEffect(() => {
        const currentUnit = objective?.responsible_office_agency;
        setSelectedUnit(currentUnit || '');
    }, [objective]);

    if (!objective) return null;

    function assign() {
        if (!submitting && selectedUnit.trim()) onAssign(selectedUnit.trim());
    }

    return React.createElement('div', { className: 'objective-modal-backdrop' },
        React.createElement('section', {
            className: 'objective-modal ui-card',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'assign-unit-title',
            onKeyDown: (event) => { if (event.key === 'Escape' && !submitting) onClose(); },
        },
        React.createElement('div', { className: 'objective-modal__header' },
            React.createElement('h2', { id: 'assign-unit-title' }, 'Assign Responsible Unit'),
            React.createElement('button', { type: 'button', disabled: submitting, onClick: onClose, 'aria-label': 'Close assignment' }, '×')),
        React.createElement('div', { className: 'objective-modal__body' },
            React.createElement('p', null, objective.objective_title || 'Untitled objective'),
            React.createElement('label', { className: 'ui-label', htmlFor: 'responsible-unit' }, 'Responsible Unit'),
            React.createElement('input', {
                id: 'responsible-unit',
                className: 'ui-input',
                value: selectedUnit,
                list: 'responsible-unit-options',
                placeholder: 'Select or type the exact Office / Agency name',
                autoFocus: true,
                disabled: submitting,
                required: true,
                'aria-invalid': Boolean(error),
                onChange: (event) => setSelectedUnit(event.target.value),
            }),
            React.createElement('datalist', { id: 'responsible-unit-options' }, availableUnits.map((unit) => React.createElement('option', { key: unit, value: unit }))),
            React.createElement('small', { className: 'ui-help' }, 'The name must match the Office / Agency account so the objective appears in its workspace.'),
            error ? React.createElement('p', { className: 'ui-error', role: 'alert' }, error) : null),
        React.createElement('div', { className: 'objective-modal__actions' },
            React.createElement('button', { type: 'button', className: 'ui-button ui-button--secondary', disabled: submitting, onClick: onClose }, 'Cancel'),
            React.createElement('button', { type: 'button', className: 'ui-button ui-button--primary', disabled: submitting || !selectedUnit, onClick: assign }, submitting ? 'Assigning…' : 'Assign')))
    );
}
