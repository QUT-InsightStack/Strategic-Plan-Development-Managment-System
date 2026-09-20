import { AppSidebar } from '../components/AppSidebar.js';
import { useDialogBehaviour } from '../components/use-dialog-behaviour.js';
import { apiRequest } from '../api/api-client.js';
import { listSubmittedInputs, getSubmittedInput, reviewSubmittedInput } from '../api/implementation-inputs-api.js';
import { createAccessSession, saveAccessSession } from '../access/access-session.js';
import { enforcePageAccess } from '../access/access-guard.js';

const h = React.createElement;
const { useState, useEffect } = React;
const statuses = { 'Pending Review': 'pending', Approved: 'accepted', Rejected: 'rejected' };
const types = { progress_update: 'Progress update', issue: 'Issue', change_request: 'Change request' };
const dateLabel = value => value ? new Date(value).toLocaleString('en-GB') : '—';
const errorLabel = error => [error.message, ...Object.values(error.errors || {}).flat()].join(' ');

function InputDialog({ id, close, saved }) {
    const [input, setInput] = useState(null);
    const [status, setStatus] = useState('Approved');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const ref = useDialogBehaviour(true, () => { if (!busy) close(); });
    useEffect(() => {
        let active = true;
        setInput(null); setError('');
        getSubmittedInput(id).then(result => { if (active) setInput(result.data); })
            .catch(err => { if (active) setError(errorLabel(err)); });
        return () => { active = false; };
    }, [id, attempt]);
    async function submit(event) {
        event.preventDefault();
        if (busy || !input?.can_review) return;
        setBusy(true); setError('');
        try { await reviewSubmittedInput(id, { status, review_note: note || null }); saved(); }
        catch (err) {
            setError(errorLabel(err));
            try { setInput((await getSubmittedInput(id)).data); } catch { setInput(null); }
        } finally { setBusy(false); }
    }
    return h('div', { className: 'consolidate-backdrop' }, h('section', {
        ref, className: 'consolidate-dialog', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'input-title',
    },
    h('header', { className: 'consolidate-dialog-heading' }, h('h2', { id: 'input-title' }, 'Submitted input'),
        h('button', { onClick: close, disabled: busy, 'aria-label': 'Close input' }, '×')),
    error && h('p', { role: 'alert' }, error, ' ', h('button', { onClick: () => setAttempt(attempt + 1) }, 'Retry')),
    !input && !error && h('p', { role: 'status' }, 'Loading input…'),
    input && h(React.Fragment, null,
        h('p', null, `${input.responsible_office_agency} · ${input.submitter_name}`),
        h('p', null, `${input.strategic_plan.title} · ${types[input.input_type]}`),
        input.objective && h('p', null, input.objective.objective_title),
        h('p', null, `Submitted: ${dateLabel(input.submitted_at)}`),
        h('div', { className: 'consolidate-original' }, input.content),
        h('p', null, `Status: ${input.review_status}`),
        input.reviewed_at && h('p', null, `Reviewed by ${input.reviewer_name} · ${dateLabel(input.reviewed_at)}`),
        input.review_note && h('div', { className: 'consolidate-original' }, input.review_note),
        input.can_review && h('form', { onSubmit: submit }, h('fieldset', { disabled: busy, className: 'office-workflow-fields' },
            h('legend', null, 'Review input'),
            h('label', { className: 'office-field-group' }, 'Decision', h('select', { value: status, onChange: e => setStatus(e.target.value) },
                ['Approved', 'Rejected'].map(value => h('option', { key: value, value }, value)))),
            h('label', { className: 'office-field-group' }, `Review note${status === 'Rejected' ? ' *' : ''}`,
                h('textarea', { value: note, rows: 4, maxLength: 5000, required: status === 'Rejected', onChange: e => setNote(e.target.value) })),
            h('button', { className: 'consolidate-primary', type: 'submit' }, busy ? 'Saving…' : 'Save decision'))))));
}

function SubmittedInputsApp() {
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({});
    const emptyFilters = { plan_id: '', responsible_unit_id: '', status: '', input_type: '', submitted_from: '', submitted_to: '', page: 1 };
    const [filters, setFilters] = useState(emptyFilters);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [selected, setSelected] = useState(null);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        let active = true;
        setLoading(true); setError(''); setRows([]); setMeta({});
        listSubmittedInputs(filters).then(result => { if (active) { setRows(result.data); setMeta(result.meta); } })
            .catch(err => { if (active) setError(errorLabel(err)); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [filters, refresh]);
    const changeFilter = (key, value) => setFilters(current => ({ ...current, [key]: value, ...(key === 'plan_id' ? { responsible_unit_id: '' } : {}), page: 1 }));
    const select = (key, label, options) => h('label', { key }, h('span', { className: 'consolidate-sr' }, label),
        h('select', { value: filters[key], disabled: loading, onChange: e => changeFilter(key, e.target.value) },
            h('option', { value: '' }, label), options.map(([value, text]) => h('option', { key: value, value }, text))));
    return h('div', { className: 'office-workspace' }, h(AppSidebar, { onNotice: setNotice }),
        h('main', { className: 'office-content consolidate-content' },
            h('header', null, h('h1', null, 'Submitted Office/Agency Inputs'), h('p', null, 'Review implementation progress across your authorized plans.')),
            notice && h('p', { role: 'status' }, notice),
            h('div', { className: 'consolidate-layout' },
                h('section', { className: 'office-panel consolidate-register', 'aria-busy': loading },
                    h('div', { className: 'consolidate-toolbar' }, h('h2', null, 'Submitted inputs'),
                        h('div', { className: 'consolidate-filters' },
                            select('plan_id', 'All authorized plans', (meta.filters?.plans || []).map(p => [p.record_id, p.title])),
                            select('responsible_unit_id', 'All authorized offices', (meta.filters?.offices || []).map(o => [o.responsible_unit_id, o.responsible_office_agency])),
                            select('input_type', 'All input types', Object.entries(types)),
                            select('status', 'All statuses', Object.keys(statuses).map(s => [s, s])),
                            ['submitted_from', 'submitted_to'].map(key => h('label', { key }, key === 'submitted_from' ? 'From ' : 'To ',
                                h('input', { type: 'date', value: filters[key], onChange: e => changeFilter(key, e.target.value) }))),
                            h('button', { onClick: () => setFilters(emptyFilters) }, 'Clear filters'))),
                    error && h('p', { role: 'alert' }, error, ' ', h('button', { onClick: () => setRefresh(refresh + 1) }, 'Retry')),
                    h('div', { className: 'office-table-scroll' }, h('table', null,
                        h('thead', null, h('tr', null, ['Submitted by', 'Strategic plan', 'Input type', 'Input', 'Status', 'Submitted at', 'Actions'].map(label => h('th', { scope: 'col', key: label }, label)))),
                        h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 7, className: 'consolidate-empty' }, 'Loading submitted inputs…'))
                            : rows.length ? rows.map(row => h('tr', { key: row.input_id },
                                h('td', null, row.responsible_office_agency, h('small', null, row.submitter_name)),
                                h('td', null, row.strategic_plan.title, row.objective && h('small', null, row.objective.objective_title)),
                                h('td', null, types[row.input_type]), h('td', null, h('div', { className: 'consolidate-excerpt' }, row.content)),
                                h('td', null, h('span', { className: `consolidate-status is-${statuses[row.review_status]}` }, row.review_status)),
                                h('td', null, dateLabel(row.submitted_at)),
                                h('td', null, h('button', { onClick: () => setSelected(row.input_id), 'aria-label': `${row.can_review ? 'Review' : 'View'} input ${row.input_id}` }, row.can_review ? 'Review' : 'View'))))
                                : h('tr', null, h('td', { colSpan: 7, className: 'consolidate-empty' }, error ? 'Inputs could not be loaded.' : 'No submitted inputs match these filters.'))))),
                    h('footer', { className: 'office-pagination' }, h('span', null, `${meta.total || 0} inputs`),
                        h('button', { disabled: loading || filters.page <= 1, onClick: () => setFilters({ ...filters, page: filters.page - 1 }) }, 'Previous'),
                        h('span', null, `${filters.page} / ${meta.last_page || 1}`),
                        h('button', { disabled: loading || filters.page >= (meta.last_page || 1), onClick: () => setFilters({ ...filters, page: filters.page + 1 }) }, 'Next'))),
                h('aside', { className: 'office-panel consolidate-summary', 'aria-label': 'Input summary' }, h('h2', null, 'Input Summary'),
                    h('small', null, 'Authorized inputs matching the plan, office, type and date filters. Includes all statuses.'),
                    Object.entries(statuses).map(([status, style]) => h('div', { key: status, className: `consolidate-stat is-${style}` },
                        h('div', null, h('span', null, status), h('strong', null, loading || error ? '—' : meta.summary?.[status] || 0)))))),
            selected && h(InputDialog, { key: selected, id: selected, close: () => setSelected(null), saved: () => {
                setSelected(null); setNotice('Input review saved.'); setRefresh(refresh + 1);
            } })));
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading your access…'));
apiRequest('/api/auth/me').then(payload => {
    saveAccessSession(createAccessSession(payload.data));
    if (enforcePageAccess()) root.render(h(SubmittedInputsApp));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
