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
    const correction = ['Administrator', 'Planning Officer', 'Planner/Encoder'].includes(getAccessSession()?.roleName);
    const mayUpdate = can(correction ? P.OBJECTIVES_CORRECT_PROGRESS : P.OBJECTIVES_UPDATE_PROGRESS);

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
    return h('section', { className: 'ui-card' }, h('div', { className: 'ui-card__body' },
        h('h2', null, correction ? 'Objective progress' : 'Assigned objective progress'),
        h('p', null, '0%: Not Started · 1–99%: In Progress · 100%: Completed'),
        h('div', { role: 'status', 'aria-live': 'polite' }, message),
        error && h('p', { role: 'alert', className: 'ui-status ui-status--error' }, error),
        h('div', { className: 'plans-toolbar' },
            h('label', { className: 'ui-field' }, 'Search objectives', h('input', { className: 'ui-input', value: filters.search, onChange: event => filter('search', event.target.value) })),
            h('label', { className: 'ui-field' }, 'Progress status', h('select', { className: 'ui-select', value: filters.progress_status, onChange: event => filter('progress_status', event.target.value) },
                h('option', { value: '' }, 'All statuses'), ...['not_started', 'in_progress', 'completed'].map(status => h('option', { key: status, value: status }, progressStatusLabel(status)))))),
        loading ? h('p', { role: 'status' }, 'Loading progress…') : h(React.Fragment, null,
            h('div', { style: { overflowX: 'auto' } }, h('table', { className: 'ui-table' },
                h('thead', null, h('tr', null, ...['Objective', 'Plan', 'Office/Unit', 'Progress', 'Last update', 'Actions'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                h('tbody', null, rows.length ? rows.map(row => h('tr', { key: row.objective_id },
                    h('td', null, row.objective_title || 'Untitled objective'), h('td', null, row.strategic_plan?.title),
                    h('td', null, row.responsible_office_agency || 'Unassigned'),
                    h('td', null, `${row.progress_percentage}% · ${progressStatusLabel(row.progress_status)}`),
                    h('td', null, date(row.progress_updated_at), row.progress_updater && h('small', { style: { display: 'block' } }, `${row.progress_updater.first_name} ${row.progress_updater.last_name}`)),
                    h('td', null,
                        mayUpdate && !['archived', 'deleted'].includes(row.status) && !['archived', 'deleted'].includes(row.strategic_plan?.status)
                            && button('Update progress', () => { setSelected(row); setPercentage(String(row.progress_percentage)); setReason(''); setError(''); setMessage(''); }, saving),
                        button('History', () => { setHistory(row); setHistoryPage(1); }, saving))))
                    : h('tr', null, h('td', { colSpan: 6 }, 'No objectives match these filters.'))))),
            h('div', { className: 'plans-filter-actions' }, button('Previous', () => setPage(value => value - 1), page <= 1),
                h('span', null, `Page ${page} of ${meta.last_page} · ${meta.total} objectives`), button('Next', () => setPage(value => value + 1), page >= meta.last_page))),
        selected && h('form', { onSubmit: save }, h('fieldset', { disabled: saving },
            h('legend', null, `Update progress: ${selected.objective_title}`),
            h('label', { className: 'ui-field' }, 'Progress (%)', h('input', { className: 'ui-input', type: 'number', min: 0, max: 100, step: 1, required: true, value: percentage, onChange: event => setPercentage(event.target.value) })),
            h('p', { 'aria-live': 'polite' }, `Calculated status: ${progressStatusLabel(calculatedProgressStatus(percentage)) || 'Enter a whole number from 0 to 100'}`),
            h('label', { className: 'ui-field' }, correction ? 'Reason for correction (required)' : 'Progress notes (optional)', h('textarea', { className: 'ui-input', required: correction, maxLength: 5000, value: reason, onChange: event => setReason(event.target.value) })),
            h('button', { type: 'submit', className: 'ui-button ui-button--primary', disabled: saving || !calculatedProgressStatus(percentage) || (correction && !reason.trim()) }, saving ? 'Saving…' : 'Save progress'),
            button('Cancel', () => setSelected(null), saving))),
        history && h('section', null, h('h3', null, `Progress history: ${history.objective_title}`), button('Close history', () => setHistory(null)),
            historyLoading ? h('p', { role: 'status' }, 'Loading history…') : h(React.Fragment, null,
                historyRows.length ? h('ol', null, historyRows.map(update => h('li', { key: update.progress_update_id },
                    h('p', null, `${update.previous_percentage}% (${progressStatusLabel(update.previous_status)}) → ${update.new_percentage}% (${progressStatusLabel(update.new_status)})`),
                    h('p', null, `${update.updater_name} · ${update.updater_role} · ${date(update.created_at)}`),
                    update.reason && h('p', { style: { whiteSpace: 'pre-wrap' } }, update.reason)))) : h('p', null, 'No progress updates recorded.'),
                h('div', { className: 'plans-filter-actions' }, button('Previous history', () => setHistoryPage(value => value - 1), historyPage <= 1),
                    h('span', null, `Page ${historyPage} of ${historyMeta.last_page}`), button('Next history', () => setHistoryPage(value => value + 1), historyPage >= historyMeta.last_page))))));
}
