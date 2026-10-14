// Section-level states for Management pages: each section waits for, or reports failure of,
// only the data sources it uses, so one failed request never blanks the whole page.
const h = (...args) => React.createElement(...args);

export function useManagementSource(loader, { enabled = true, deps = [] } = {}) {
    const [attempt, setAttempt] = React.useState(0);
    const [state, setState] = React.useState({ data: [], status: enabled ? 'loading' : 'forbidden', error: '' });
    React.useEffect(() => {
        if (!enabled) { setState({ data: [], status: 'forbidden', error: '' }); return undefined; }
        let active = true;
        setState(previous => ({ ...previous, status: 'loading', error: '' }));
        Promise.resolve().then(loader).then(data => {
            if (active) setState({ data, status: 'ready', error: '' });
        }).catch(reason => {
            if (active) setState({ data: [], status: 'error', error: reason?.message || 'The request failed.' });
        });
        return () => { active = false; };
    }, [enabled, attempt, ...deps]);
    return { ...state, retry: () => setAttempt(value => value + 1) };
}

export function Skeleton({ lines = 4, label = 'Loading…' }) {
    return h('div', { className: 'management-skeleton-block', role: 'status', 'aria-live': 'polite' },
        h('span', { className: 'ui-visually-hidden' }, label),
        Array.from({ length: lines }, (_, index) => h('span', { key: index, className: 'management-skeleton', 'aria-hidden': true, style: { width: `${92 - (index % 3) * 14}%` } })));
}

// sources: [{ label, source }]. Returns a placeholder element, or null when every source is ready.
export function sectionGate(sources, { lines = 4, forbidden = '' } = {}) {
    const failed = sources.filter(item => item.source.status === 'error');
    if (failed.length) {
        return h('div', { className: 'management-section-error', role: 'alert' },
            failed.map(item => h('p', { key: item.label }, `${item.label} could not be loaded: ${item.source.error}`)),
            h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => failed.forEach(item => item.source.retry()) },
                h('i', { className: 'bi bi-arrow-clockwise', 'aria-hidden': true }), ' Retry'));
    }
    const denied = sources.find(item => item.source.status === 'forbidden');
    if (denied) return h('p', { className: 'management-empty management-empty--denied' }, h('i', { className: 'bi bi-lock', 'aria-hidden': true }), ' ', forbidden || `You do not have permission to view ${denied.label.toLowerCase()}.`);
    if (sources.some(item => item.source.status === 'loading')) return h(Skeleton, { lines, label: `Loading ${sources.map(item => item.label.toLowerCase()).join(', ')}…` });
    return null;
}

export function EmptyState({ filtered, onClear, message = 'No data in your authorised scope.' }) {
    return filtered
        ? h('div', { className: 'management-empty management-empty--filtered' },
            h('p', null, 'No results match the current filters.'),
            h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: onClear }, 'Clear filters'))
        : h('p', { className: 'management-empty' }, message);
}

export function SectionCard({ title, description, actions, className = '', children, labelledBy }) {
    const id = labelledBy || `section-${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return h('section', { className: `management-card ${className}`.trim(), 'aria-labelledby': id },
        h('div', { className: 'management-card__heading' },
            h('div', null, h('h2', { id }, title), description ? h('p', null, description) : null),
            actions ? h('div', { className: 'management-card__actions' }, actions) : null),
        children);
}
