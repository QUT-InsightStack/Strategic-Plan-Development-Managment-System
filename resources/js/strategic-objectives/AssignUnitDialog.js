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
    const currentId =
        objective?.responsible_unit_assignment?.responsible_unit_id
        ?? objective?.responsible_unit_assignment?.responsible_unit?.responsible_unit_id;

    const matchedUnit = availableUnits.find(unit =>
        currentId != null
            ? Number(unit.responsible_unit_id) === Number(currentId)
            : unit.responsible_office_agency === objective?.responsible_office_agency
    );

    setSelectedUnit(
        matchedUnit ? String(matchedUnit.responsible_unit_id) : ''
    );
}, [objective, availableUnits]);

    if (!objective) return null;

    function assign() {
       if (!submitting && selectedUnit) onAssign(Number(selectedUnit));
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
            React.createElement('select', {
                id: 'responsible-unit',
                className: 'ui-select',
                value: selectedUnit,
                autoFocus: true,
                disabled: submitting || availableUnits.length === 0,
                required: true,
                'aria-invalid': Boolean(error),
                onChange: event => setSelectedUnit(event.target.value),
            },
                React.createElement('option', { value: '' }, 'Select an Office/Unit'),
                availableUnits.map(unit => React.createElement('option', {
                    key: unit.responsible_unit_id,
                    value: String(unit.responsible_unit_id),
                }, unit.responsible_office_agency))
            ),
            React.createElement('datalist', { id: 'responsible-unit-options' }, availableUnits.map((unit) => React.createElement('option', { key: unit, value: unit }))),
            React.createElement('small', { className: 'ui-help' }, 'Choose the Office/Unit responsible for this objective. Its users must belong to the same registered Office/Unit.'),
            error ? React.createElement('p', { className: 'ui-error', role: 'alert' }, error) : null),
        React.createElement('div', { className: 'objective-modal__actions' },
            React.createElement('button', { type: 'button', className: 'ui-button ui-button--secondary', disabled: submitting, onClick: onClose }, 'Cancel'),
            React.createElement('button', { type: 'button', className: 'ui-button ui-button--primary', disabled: submitting || !selectedUnit, onClick: assign }, submitting ? 'Assigning…' : 'Assign')))
    );
}
