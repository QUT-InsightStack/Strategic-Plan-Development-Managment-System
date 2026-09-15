import { AppSidebar } from '../components/AppSidebar.js';
import { useDialogBehaviour } from '../components/use-dialog-behaviour.js';
import { apiRequest } from '../api/api-client.js';
import { getStrategicPlan } from '../api/strategic-plans-api.js';
import { listStrategicObjectives } from '../api/strategic-objectives-api.js';
import { createAccessSession, saveAccessSession } from '../access/access-session.js';
import { enforcePageAccess } from '../access/access-guard.js';
import { listLocalAgencyInputs, reviewLocalAgencyInput } from '../office-demo-storage.js';

const h = React.createElement;
const { useState, useEffect } = React;
const labels = { pending: 'Pending Review', accepted: 'Accepted', returned: 'Returned', rejected: 'Rejected', merged: 'Merged' };
const typeLabel = type => type === 'core_value' ? 'Core value' : type === 'comment' ? 'Comment' : 'Objective';
const dateLabel = date => date ? new Date(date).toLocaleDateString('en-GB') : '—';
const errorLabel = error => [error.message, ...Object.values(error.errors || {}).flat()].join(' ');

function ReviewDialog({ input, close, saved }) {
    const [values, setValues] = useState({ ...input.payload });
    const [action, setAction] = useState('accepted');
    const [note, setNote] = useState('');
    const [target, setTarget] = useState('');
    const [targets, setTargets] = useState([]);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const editable = input.status === 'pending' && input.plan?.status === 'draft';
    const ref = useDialogBehaviour(true, () => { if (!busy) close(); });
    useEffect(() => {
        if (action !== 'merged') return;
        let active = true;
        setLoading(true); setError('');
        const load = input.type === 'objective' ? listStrategicObjectives(input.plan_id) : getStrategicPlan(input.plan_id);
        load.then(result => {
            if (!active) return;
            setTargets(input.type === 'objective'
                ? result.data.filter(item => item.status === 'draft' && item.objective_id !== input.source_objective_id)
                : (result.data.core_values || []).filter(item => item.status === 'active'));
        }).catch(err => { if (active) setError(errorLabel(err)); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [action, input.id]);
    function selectTarget(id) {
        setTarget(id);
        const item = targets.find(item => String(item.objective_id || item.foundation_id) === id);
        if (!item) { setValues({ ...input.payload }); return; }
        setValues(input.type === 'core_value' ? { content: [item.content, input.payload.content].filter(Boolean).join('\n\n') }
            : { objective_title: item.objective_title, objective_description: [item.objective_description, input.payload.objective_description].filter(Boolean).join('\n\n'), expected_outcome: item.expected_outcome || input.payload.expected_outcome || '', indicator: item.indicator || input.payload.indicator || '', target: item.target || input.payload.target || '' });
    }
    async function submit(event) {
        event.preventDefault();
        if (busy || !editable) return;
        setBusy(true); setError('');
        try {
            reviewLocalAgencyInput(input.id, { ...values, action, note, target_id: target || null, version: input.version });
            saved();
        } catch (err) { setError(errorLabel(err)); } finally { setBusy(false); }
    }
    const field = (key, label, required = false) => h('label', { key, className: 'office-field-group' }, label,
        h(key === 'objective_title' || key === 'target' ? 'input' : 'textarea', { required, value: values[key] || '', rows: 3, maxLength: ['objective_title', 'target'].includes(key) ? 255 : 10000, onChange: event => setValues({ ...values, [key]: event.target.value }) }));
    return h('div', { className: 'consolidate-backdrop' }, h('section', { ref, className: 'consolidate-dialog', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'review-title' },
        h('header', { className: 'consolidate-dialog-heading' }, h('div', null, h('h2', { id: 'review-title' }, editable ? 'Review agency input' : 'Input details'), h('p', null, `${input.office} · ${typeLabel(input.type)} · ${input.plan?.title || 'Plan'}`)), h('button', { onClick: close, disabled: busy, 'aria-label': 'Close review' }, '×')),
        h('div', { className: 'consolidate-original' }, h('strong', null, 'Original submission'), h('p', null, input.payload.objective_title), h('p', null, input.payload.content || input.payload.objective_description)),
        error && h('p', { role: 'alert' }, error),
        editable ? h('form', { onSubmit: submit }, h('fieldset', { disabled: busy, className: 'office-workflow-fields' },
            h('label', { className: 'office-field-group' }, 'Decision', h('select', { value: action, onChange: event => { setAction(event.target.value); setTarget(''); setValues({ ...input.payload }); setError(''); } }, (input.type === 'comment' ? ['accepted', 'returned', 'rejected'] : ['accepted', 'returned', 'rejected', 'merged']).map(value => h('option', { value, key: value }, { accepted: input.type === 'comment' ? 'Acknowledge comment' : 'Accept into draft plan', returned: 'Return for revision', rejected: 'Reject input', merged: 'Merge with existing content' }[value])))),
            action === 'merged' && h('label', { className: 'office-field-group' }, 'Merge target in this plan', h('select', { required: true, value: target, disabled: loading, onChange: event => selectTarget(event.target.value) }, h('option', { value: '' }, loading ? 'Loading targets…' : 'Select existing content'), targets.map(item => h('option', { key: item.objective_id || item.foundation_id, value: item.objective_id || item.foundation_id }, item.objective_title || item.content))), !loading && !targets.length && h('small', null, 'No eligible targets. Accept this input separately instead.')),
            input.type !== 'comment' && ['accepted', 'merged'].includes(action) && h('section', { className: 'consolidate-refinement' }, h('h3', null, action === 'merged' ? 'Final merged content' : 'Refine before accepting'), action === 'merged' && h('p', null, 'The text below will replace the selected content in this draft plan. Review it before saving.'),
                input.type === 'core_value' ? field('content', 'Core value', true) : [field('objective_title', 'Objective title', true), field('objective_description', 'Description', true), field('expected_outcome', 'Expected outcome'), field('indicator', 'Indicator'), field('target', 'Target')]),
            h('label', { className: 'office-field-group' }, `Review note${action !== 'accepted' ? ' *' : ''}`, h('textarea', { rows: 3, maxLength: 5000, required: action !== 'accepted', value: note, onChange: event => setNote(event.target.value) })),
            h('div', { className: 'office-detail-actions' }, h('button', { type: 'button', onClick: close }, 'Cancel'), h('button', { className: 'consolidate-primary', type: 'submit', disabled: loading || (action === 'merged' && !target) }, busy ? 'Saving…' : 'Save decision'))))
            : h('section', null, h('p', null, `Status: ${labels[input.status]}`), input.plan?.status !== 'draft' && h('p', null, 'This plan is read-only.'), h('p', null, input.review_note || 'No review note.'), input.result_id && h('p', null, `Consolidated ${typeLabel(input.type).toLowerCase()} ID: ${input.result_id}`)),
        input.history?.length > 0 && h('details', null, h('summary', null, 'Review history'), input.history.map((event, index) => h('article', { className: 'office-update', key: index }, h('strong', null, event.action), h('small', null, ` · ${dateLabel(event.at)}`), h('p', null, event.note), event.refined_payload && h('p', null, event.refined_payload.content || event.refined_payload.objective_description))))));
}

function ConsolidateInputsApp() {
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({});
    const [filters, setFilters] = useState({ office: '', status: '', page: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [selected, setSelected] = useState(null);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        let active = true;
        setLoading(true); setError('');
        try { const result = listLocalAgencyInputs(filters); if (active) { setRows(result.data); setMeta(result.meta); setLoading(false); } }
        catch (err) { if (active) { setError(errorLabel(err)); setRows([]); setMeta({}); setLoading(false); } }
        return () => { active = false; };
    }, [filters, refresh]);
    return h('div', { className: 'office-workspace' }, h(AppSidebar, { onNotice: setNotice }), h('main', { className: 'office-content consolidate-content' },
        h('header', null, h('h1', null, 'Consolidate Agency Inputs'), h('p', null, 'Review, refine, and consolidate inputs submitted by offices and agencies.')),
        notice && h('p', { role: 'status' }, notice),
        h('div', { className: 'consolidate-layout' }, h('section', { className: 'office-panel consolidate-register', 'aria-busy': loading },
            h('div', { className: 'consolidate-toolbar' }, h('h2', null, 'Agency Inputs'), h('div', { className: 'consolidate-filters' },
                h('label', null, h('span', { className: 'consolidate-sr' }, 'Responsible office'), h('select', { value: filters.office, onChange: event => setFilters({ ...filters, office: event.target.value, page: 1 }) }, h('option', { value: '' }, 'All responsible offices'), (meta.offices || []).map(office => h('option', { key: office, value: office }, office)))),
                h('label', null, h('span', { className: 'consolidate-sr' }, 'Input status'), h('select', { value: filters.status, onChange: event => setFilters({ ...filters, status: event.target.value, page: 1 }) }, h('option', { value: '' }, 'All statuses'), Object.entries(labels).map(([value, label]) => h('option', { key: value, value }, label)))))),
            error && h('p', { role: 'alert' }, error, ' ', h('button', { onClick: () => setRefresh(refresh + 1) }, 'Retry')),
            h('div', { className: 'office-table-scroll' }, h('table', null,
                h('thead', null, h('tr', null, ['Created by', 'Input type', 'Comments / input', 'Status', 'Submit time', 'Actions'].map(label => h('th', { scope: 'col', key: label }, label)))),
                h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 6, className: 'consolidate-empty' }, 'Loading agency inputs…')) : rows.length ? rows.map(row => h('tr', { key: row.id },
                    h('td', null, h('div', { className: 'consolidate-office' }, h('span', { className: 'consolidate-avatar', 'aria-hidden': true }, row.office.slice(0, 1).toUpperCase()), h('div', null, row.office, h('small', null, [row.creator?.first_name, row.creator?.last_name].filter(Boolean).join(' '))))),
                    h('td', null, typeLabel(row.type)), h('td', null, h('div', { className: 'consolidate-excerpt' }, row.payload.objective_title || row.payload.content), h('small', null, row.plan?.title)),
                    h('td', null, h('span', { className: `consolidate-status is-${row.status}` }, labels[row.status])), h('td', null, dateLabel(row.created_at)),
                    h('td', null, h('button', { onClick: () => setSelected(row), 'aria-label': `${row.status === 'pending' ? 'Review' : 'View'} input from ${row.office}` }, row.status === 'pending' && row.plan?.status === 'draft' ? 'Review' : 'View')))) : h('tr', null, h('td', { colSpan: 6, className: 'consolidate-empty' }, error ? 'Inputs could not be loaded.' : 'No agency inputs match these filters.'))))),
            h('footer', { className: 'office-pagination' }, h('span', null, `${meta.total || 0} inputs`), h('button', { disabled: loading || filters.page <= 1, onClick: () => setFilters({ ...filters, page: filters.page - 1 }) }, 'Previous'), h('span', null, `${filters.page} / ${meta.last_page || 1}`), h('button', { disabled: loading || filters.page >= (meta.last_page || 1), onClick: () => setFilters({ ...filters, page: filters.page + 1 }) }, 'Next')),
            h('div', { className: 'consolidate-guidance' }, h('i', { className: 'bi bi-info-circle', 'aria-hidden': true }), h('div', null, h('p', null, 'Offices and agencies submit comments, objectives, and core values for review.'), h('p', null, 'Acknowledge comments, or accept and merge planning inputs into the draft strategic plan.')))),
            h('aside', { className: 'office-panel consolidate-summary', 'aria-label': 'Input summary' }, h('h2', null, 'Input Summary'), h('small', null, 'All accessible plans'),
                ['merged', 'accepted', 'pending', 'returned', 'rejected'].map(status => h('div', { key: status, className: `consolidate-stat is-${status}` }, h('i', { className: `bi ${status === 'merged' ? 'bi-intersect' : status === 'accepted' ? 'bi-check2-circle' : status === 'pending' ? 'bi-clock-history' : status === 'returned' ? 'bi-arrow-return-left' : 'bi-x-circle'}`, 'aria-hidden': true }), h('div', null, h('span', null, labels[status]), h('strong', null, loading ? '—' : meta.summary?.[status] || 0)))),
                h('section', { className: 'consolidate-updates' }, h('h3', null, 'Key Updates'), (meta.recent || []).map(item => h('p', { key: item.id }, `${item.office}: ${labels[item.status]} · ${dateLabel(item.updated_at)}`)), !loading && !meta.recent?.length && h('p', null, 'No input activity yet.')))),
        selected && h(ReviewDialog, { key: selected.id, input: selected, close: () => setSelected(null), saved: () => { setSelected(null); setNotice('Input review saved.'); setRefresh(refresh + 1); } })));
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading your access…'));
apiRequest('/api/auth/me').then(payload => {
    saveAccessSession(createAccessSession(payload.data));
    if (enforcePageAccess()) root.render(h(ConsolidateInputsApp));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
