// Shared filter bar for list pages: one card, labelled fields in a wrapping row, actions on the right.
// Pages only choose their fields. Pass onSubmit for server-side filters that apply on "Filter";
// omit it for filters that apply as the user types or selects.
const h = (...args) => React.createElement(...args);

export function FilterBar({ label, onSubmit, onClear, busy = false, submitLabel = 'Filter', clearLabel = 'Clear', className = '', children }) {
    return h('form', {
        className: `ui-card ui-filter-bar ${className}`.trim(),
        role: 'search',
        'aria-label': label,
        onSubmit: (event) => { event.preventDefault(); if (onSubmit) onSubmit(event); },
    },
        h('div', { className: 'ui-filter-bar__fields' }, children),
        h('div', { className: 'ui-filter-bar__actions' },
            onSubmit ? h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'submit', disabled: busy }, h('i', { className: 'bi bi-funnel', 'aria-hidden': 'true' }), submitLabel) : null,
            onClear ? h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: busy, onClick: onClear }, clearLabel) : null
        )
    );
}

// Any labelled control; the helpers below cover the usual inputs.
// Props for the control itself so screen readers announce a field's error.
const invalid = (id, error) => error ? { 'aria-invalid': 'true', 'aria-describedby': `${id}-error` } : {};
export function FilterField({ id, label, error = '', wide = false, children }) {
    return h('div', { className: `ui-field ui-filter-bar__field${wide ? ' ui-filter-bar__field--search' : ''}${error ? ' is-invalid' : ''}` },
        h('label', { className: 'ui-label', htmlFor: id }, label),
        children,
        error ? h('p', { className: 'ui-error', id: `${id}-error` }, error) : null
    );
}

export function FilterSearch({ id, label, value, onChange, placeholder = '', disabled = false, maxLength, error }) {
    return h(FilterField, { id, label, error, wide: true },
        h('div', { className: 'ui-filter-bar__search' },
            h('i', { className: 'bi bi-search', 'aria-hidden': 'true' }),
            h('input', { className: 'ui-input', id, type: 'search', value, placeholder, disabled, maxLength, ...invalid(id, error), onChange: (event) => onChange(event.target.value) })
        )
    );
}

export function FilterText({ id, label, value, onChange, placeholder = '', disabled = false, maxLength, error }) {
    return h(FilterField, { id, label, error },
        h('input', { className: 'ui-input', id, value, placeholder, disabled, maxLength, ...invalid(id, error), onChange: (event) => onChange(event.target.value) })
    );
}

// options: [[value, text], ...]; allLabel adds a leading "all" option with an empty value.
export function FilterSelect({ id, label, value, onChange, options, allLabel = null, disabled = false, error }) {
    return h(FilterField, { id, label, error },
        h('select', { className: 'ui-select', id, value, disabled, ...invalid(id, error), onChange: (event) => onChange(event.target.value) },
            allLabel !== null ? h('option', { value: '' }, allLabel) : null,
            options.map(([optionValue, text]) => h('option', { key: optionValue, value: optionValue }, text))
        )
    );
}

export function FilterDate({ id, label, value, onChange, disabled = false, min, max, error }) {
    return h(FilterField, { id, label, error },
        h('input', { className: 'ui-input', id, type: 'date', value, disabled, min, max, ...invalid(id, error), onChange: (event) => onChange(event.target.value) })
    );
}
