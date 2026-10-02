import { calculatedProgressStatus, progressStatusLabel, listObjectiveProgress, updateObjectiveProgress, listObjectiveProgressHistory } from '../api/objective-progress-api.js';
import { can, getAccessSession } from '../access/access-session.js';
import { PERMISSIONS as P } from '../access/access-policy.js';

const h = React.createElement;
const date = value => value ? new Date(value).toLocaleString() : 'No updates yet';

export function ObjectiveProgressPanel({ planId = '' }) {
    const [rows, setRows] = React.useState([]);
    const [meta, setMeta] = React.useState({ last_page: 1, total: 0 });
    const [filters, setFilters] = React.useState({ search: '', progress_status: '' });
    const [page, setPage] = React.useState(1);
    const [version, setVersion] = React.useState(0);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [selected, setSelected] = React.useState(null);
    const [percentage, setPercentage] = React.useState('');
    const [reason, setReason] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [history, setHistory] = React.useState(null);
    const [historyRows, setHistoryRows] = React.useState([]);
    const [historyPage, setHistoryPage] = React.useState(1);
    const [historyMeta, setHistoryMeta] = React.useState({ last_page: 1 });
    const [historyLoading, setHistoryLoading] = React.useState(false);
    const correction = can(P.OBJECTIVES_CORRECT_PROGRESS);
    const mayUpdate = can(correction ? P.OBJECTIVES_CORRECT_PROGRESS : P.OBJECTIVES_UPDATE_PROGRESS);
    const session = getAccessSession();

    React.useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        listObjectiveProgress({ plan_id: planId, ...filters, page }).then(result => {
            if (active) { setRows(result.data); setMeta(result.meta); }
        }).catch(err => { if (active) { setRows([]); setError(err.message); } })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [planId, filters, page, version]);

    React.useEffect(() => {
        if (!history) return;
        let active = true;
        setHistoryLoading(true); setHistoryRows([]);
        listObjectiveProgressHistory(history.objective_id, historyPage).then(result => {
            if (active) { setHistoryRows(result.data); setHistoryMeta(result.meta); }
        }).catch(err => { if (active) setError(err.message); })
            .finally(() => { if (active) setHistoryLoading(false); });
        return () => { active = false; };
    }, [history, historyPage, version]);

    async function save(event) {
        event.preventDefault();
        if (saving) return;
        if (!calculatedProgressStatus(percentage)) { setError('Enter a whole-number percentage from 0 to 100.'); return; }
        if (correction && !reason.trim()) { setError('Provide a reason for this change.'); return; }
        setSaving(true); setError(''); setMessage('');
        try {
            await updateObjectiveProgress(selected.objective_id, percentage, reason);
            setSelected(null); setVersion(value => value + 1); setMessage('Progress saved.');
        } catch (err) {
            setError([err.message, ...Object.values(err.errors || {}).flat()].join(' '));
        } finally { setSaving(false); }
    }

    const filter = (key, value) => { setPage(1); setFilters(current => ({ ...current, [key]: value })); };
    const button = (label, onClick, disabled = false) => h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', onClick, disabled }, label);
    const activeFilters = Boolean(filters.search || filters.progress_status);

    const accountCard = h('section', { className: 'ui-card progress-monitor-assignment-card', 'aria-label': 'Current account information' },
        h('div', { className: 'progress-monitor-assignment-icon', 'aria-hidden': 'true' }, h('i', { className: correction ? 'bi bi-person-check-fill' : 'bi bi-building' })),
        h('div', null,
            h('small', null, session?.roleName === 'Planning Officer' ? 'Signed in planning officer' : 'Signed in user'),
            h('strong', null, session?.name || 'Current user'),
            h('span', null, [session?.roleLabel || session?.roleName, session?.office || session?.department].filter(Boolean).join(' · ') || 'Account details unavailable')));

    const filterCard = h('section', { className: 'ui-card progress-monitor-filter-card', 'aria-labelledby': 'progress-monitor-filter-title' },
        h('div', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' },
                h('h2', { id: 'progress-monitor-filter-title' }, 'Find objectives'),
                h('p', null, 'Search objectives or filter by the calculated progress status.')),
            h('i', { className: 'bi bi-funnel', 'aria-hidden': 'true' })),
        h('div', { className: 'ui-card__body' },
            h('div', { className: 'progress-monitor-filters' },
                h('label', { className: 'ui-field' },
                    h('span', { className: 'ui-label' }, 'Objective title'),
                    h('input', { className: 'ui-input', type: 'search', value: filters.search, placeholder: 'Search objectives', onChange: event => filter('search', event.target.value) })),
                h('label', { className: 'ui-field' },
                    h('span', { className: 'ui-label' }, 'Progress status'),
                    h('select', { className: 'ui-select', value: filters.progress_status, onChange: event => filter('progress_status', event.target.value) },
                        h('option', { value: '' }, 'All statuses'),
                        ...['not_started', 'in_progress', 'completed'].map(status => h('option', { key: status, value: status }, progressStatusLabel(status))))),
                h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: !activeFilters,
                    onClick: () => { setPage(1); setFilters({ search: '', progress_status: '' }); } }, 'Clear'))));

    const table = h('table', { className: 'ui-table progress-monitor-table' },
        h('thead', null, h('tr', null, ...['Objective', 'Strategic plan', 'Office/Unit', 'Current progress', 'Last updated', 'Actions'].map(label => h('th', { key: label, scope: 'col' }, label)))),
        h('tbody', null, rows.map(row => {
            const canChange = mayUpdate && !['archived', 'deleted'].includes(row.status) && !['archived', 'deleted'].includes(row.strategic_plan?.status);
            const actionButtons = [
                canChange && button(correction ? 'Correct progress' : 'Update progress', () => { setSelected(row); setPercentage(String(row.progress_percentage)); setReason(''); setError(''); setMessage(''); }, saving),
                button('History', () => { setHistory(row); setHistoryPage(1); setError(''); }, saving),
            ];
            return h('tr', { key: row.objective_id },
                h('td', null, h('strong', null, row.objective_title || 'Untitled objective'), h('small', { className: 'progress-monitor-id' }, `Objective ${row.objective_id}`)),
                h('td', null, row.strategic_plan?.title || '—'),
                h('td', null, row.responsible_office_agency || 'Unassigned'),
                h('td', null, h('strong', null, `${row.progress_percentage}%`), h('span', { className: `progress-monitor-status is-${row.progress_status}` }, progressStatusLabel(row.progress_status))),
                h('td', null, date(row.progress_updated_at), row.progress_updater && h('small', { className: 'progress-monitor-updater' }, `${row.progress_updater.first_name} ${row.progress_updater.last_name}`)),
                h('td', { className: 'progress-monitor-actions' }, actionButtons));
        })));

    let listContent;
    if (loading) {
        listContent = h('div', { className: 'progress-monitor-empty', role: 'status' }, h('p', null, 'Loading objective progress…'));
    } else if (rows.length) {
        listContent = h(React.Fragment, null,
            h('div', { className: 'progress-monitor-table-wrap' }, table),
            h('div', { className: 'progress-monitor-pagination' },
                button('Previous', () => setPage(value => value - 1), page <= 1),
                h('span', null, `Page ${page} of ${meta.last_page || 1} · ${meta.total || 0} objectives`),
                button('Next', () => setPage(value => value + 1), page >= (meta.last_page || 1))));
    } else {
        listContent = h('div', { className: 'progress-monitor-empty' },
            h('i', { className: 'bi bi-clipboard2-check', 'aria-hidden': 'true' }),
            h('h3', null, activeFilters ? 'No objectives match these filters' : 'No objective progress is available'),
            h('p', null, activeFilters ? 'Clear or change the filters to see other objectives.' : correction ? 'Objective progress will appear here when progress has been initialized.' : 'Objectives assigned to your Office/Unit will appear here.'));
    }

    const listCard = h('section', { className: 'ui-card progress-monitor-list-card', 'aria-labelledby': 'progress-monitor-list-title' },
        h('div', { className: 'progress-monitor-list-heading' },
            h('div', null,
                h('h2', { id: 'progress-monitor-list-title' }, 'Strategic Objectives for Progress Monitoring'),
                h('p', null, loading ? 'Loading objectives…' : `${meta.total || 0} objective${meta.total === 1 ? '' : 's'}`))),
        listContent);

    const editor = selected ? h('section', { className: 'ui-card progress-monitor-editor', 'aria-labelledby': 'progress-editor-title' },
        h('div', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' },
                h('h2', { id: 'progress-editor-title' }, `${correction ? 'Correct progress' : 'Update progress'}: ${selected.objective_title}`),
                h('p', null, `${selected.strategic_plan?.title || 'Strategic plan'} · Current progress ${selected.progress_percentage}%`))),
        h('form', { className: 'progress-monitor-editor-form', onSubmit: save },
            h('fieldset', { disabled: saving },
                h('label', { className: 'ui-field' },
                    h('span', { className: 'ui-label' }, 'Progress (%)'),
                    h('input', { className: 'ui-input', type: 'number', min: 0, max: 100, step: 1, required: true, value: percentage, onChange: event => setPercentage(event.target.value) })),
                h('p', { className: 'progress-monitor-calculated', 'aria-live': 'polite' }, `Calculated status: ${progressStatusLabel(calculatedProgressStatus(percentage)) || 'Enter a whole number from 0 to 100'}`),
                h('label', { className: 'ui-field' },
                    h('span', { className: 'ui-label' }, correction ? 'Reason for correction (required)' : 'Progress notes (optional)'),
                    h('textarea', { className: 'ui-input', required: correction, maxLength: 5000, value: reason, onChange: event => setReason(event.target.value) })),
                h('div', { className: 'progress-monitor-editor-actions' },
                    h('button', { type: 'submit', className: 'ui-button ui-button--primary', disabled: saving || !calculatedProgressStatus(percentage) || (correction && !reason.trim()) }, saving ? 'Saving…' : correction ? 'Save correction' : 'Save progress'),
                    button('Cancel', () => setSelected(null), saving))))) : null;

    const historyCard = history ? h('section', { className: 'ui-card progress-monitor-history', 'aria-labelledby': 'progress-history-title' },
        h('div', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' },
                h('h2', { id: 'progress-history-title' }, `Progress history: ${history.objective_title}`),
                h('p', null, history.strategic_plan?.title || 'Strategic plan')),
            button('Close history', () => setHistory(null))),
        historyLoading ? h('div', { className: 'ui-card__body', role: 'status' }, 'Loading history…') : h('div', { className: 'ui-card__body' },
            historyRows.length ? h('ol', { className: 'progress-monitor-history-list' }, historyRows.map(update => h('li', { key: update.progress_update_id },
                h('strong', null, `${update.previous_percentage}% (${progressStatusLabel(update.previous_status)}) → ${update.new_percentage}% (${progressStatusLabel(update.new_status)})`),
                h('span', null, `${update.updater_name} · ${update.updater_role} · ${date(update.created_at)}`),
                update.reason && h('p', null, update.reason)))) : h('p', null, 'No progress updates recorded.'),
            h('div', { className: 'progress-monitor-pagination' },
                button('Previous history', () => setHistoryPage(value => value - 1), historyPage <= 1),
                h('span', null, `Page ${historyPage} of ${historyMeta.last_page || 1}`),
                button('Next history', () => setHistoryPage(value => value + 1), historyPage >= (historyMeta.last_page || 1))))) : null;

    return h(React.Fragment, null,
        accountCard,
        message && h('div', { className: 'ui-status ui-status--success progress-monitor-feedback', role: 'status' }, message),
        error && h('div', { className: 'ui-status ui-status--error progress-monitor-feedback', role: 'alert' }, error),
        filterCard, listCard, editor, historyCard);
}
