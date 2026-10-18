import { createPageRoot } from '../../navigation/page-root.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { useDialogBehaviour } from '../../components/use-dialog-behaviour.js';
import { apiRequest } from '../../api/api-client.js';
import { listSubmittedInputs, getSubmittedInput, reviewSubmittedInput } from '../../api/implementation-inputs-api.js';
import { createAccessSession, saveAccessSession } from '../../access/access-session.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { can } from '../../access/access-session.js';
import { ManagementObjectiveCommentsPanel } from '../../components/ManagementObjectiveCommentsPanel.js';
import { PlanSupportingDocumentsPanel } from '../../components/PlanSupportingDocumentsPanel.js';
const h = React.createElement;
const { useState, useEffect } = React;
const statuses = { 'Pending Review': 'pending', Approved: 'accepted', Rejected: 'rejected' };
const types = { progress_update: 'Progress update', issue: 'Issue', change_request: 'Change request' };
const categories = {
    new_objective: 'New Objective',
    plan_feedback: 'Plan Feedback',
    objective_feedback: 'Objective Feedback',
    mapping_feedback: 'Mapping Feedback',
};

// Review queues double as the status summary: each card shows its count and filters the register.
const queues = [
    ['Pending Review', 'Pending Review', 'bi-hourglass-split', 'pending'],
    ['Approved', 'Accepted', 'bi-check-circle', 'accepted'],
    ['Rejected', 'Declined', 'bi-x-circle', 'rejected'],
    ['', 'All Inputs', 'bi-collection', 'all'],
];

const emptyFilters = {
    plan_id: '',
    responsible_unit_id: '',
    status: '',
    input_type: '',
    feedback_category: '',
    submitted_from: '',
    submitted_to: '',
    per_page: 10,
    page: 1,
};
const scopeKeys = ['plan_id', 'responsible_unit_id', 'input_type', 'feedback_category', 'submitted_from', 'submitted_to'];
const initialFilters = () => ({ ...emptyFilters, status: can('implementation_inputs.review') ? 'Pending Review' : '' });

const categoryLabel = input =>
    categories[input.feedback_category]
    || types[input.input_type]
    || 'Earlier input';

const statusLabel = value =>
    value === 'Approved' ? 'Accepted'
        : value === 'Rejected' ? 'Declined'
        : value;
const mappingLabel = input => `${input.mapping_type === 'pdp-chapter' ? 'PDP Chapter' : 'Presidential Agenda'}: ${input.mapping_reference_title}`;
const dateLabel = value => value ? new Date(value).toLocaleString('en-GB') : '—';
const dateCell = value => value
    ? [new Date(value).toLocaleDateString('en-GB'), h('small', { key: 'time' }, new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))]
    : '—';
const errorLabel = error => [error.message, ...Object.values(error.errors || {}).flat()].join(' ');
const statusBadge = value => h('span', { className: `consolidate-status is-${statuses[value]}` }, statusLabel(value));

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
        if (!note.trim()) {
            setError('Enter reviewer remarks explaining your decision.');
            return;
        }
        setBusy(true); setError('');
        try { await reviewSubmittedInput(id, { status, review_note: note.trim() }); saved(); }
        catch (err) {
            setError(errorLabel(err));
            try { setInput((await getSubmittedInput(id)).data); } catch { setInput(null); }
        } finally { setBusy(false); }
    }
    const field = (label, value) => value ? h('div', null, h('dt', null, label), h('dd', null, value)) : null;
    return h('div', { className: 'consolidate-backdrop' }, h('section', {
        ref, className: 'consolidate-dialog', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'input-title',
    },
    h('header', { className: 'consolidate-dialog-heading' },
        h('div', null,
            h('h2', { id: 'input-title' }, input?.can_review ? 'Review input' : 'Submitted input'),
            input && h('p', null, `${input.responsible_office_agency} · ${categoryLabel(input)}`)),
        input && statusBadge(input.review_status),
        h('button', { type: 'button', className: 'consolidate-close', onClick: close, disabled: busy, 'aria-label': 'Close input' },
            h('i', { className: 'bi bi-x-lg', 'aria-hidden': true }))),
    error && h('p', { className: 'ui-status ui-status--error', role: 'alert' }, error, ' ',
        !input && h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', onClick: () => setAttempt(attempt + 1) }, 'Retry')),
    !input && !error && h('p', { role: 'status' }, 'Loading input…'),
    input && h(React.Fragment, null,
        h('dl', { className: 'consolidate-meta' },
            field('Submitted by', input.submitter_name),
            field('Submitted at', dateLabel(input.submitted_at)),
            field('Strategic plan', input.strategic_plan.title),
            field('Objective', input.objective?.objective_title),
            field('Mapping', input.mapping_reference_title && mappingLabel(input))),
        h('h3', { className: 'consolidate-block-title' }, 'Input'),
        h('div', { className: 'consolidate-original' }, input.content),
        input.reviewed_at && h(React.Fragment, null,
            h('h3', { className: 'consolidate-block-title' }, `Reviewer remarks · ${input.reviewer_name}, ${dateLabel(input.reviewed_at)}`),
            input.review_note && h('div', { className: 'consolidate-original' }, input.review_note)),
        input.can_review && h('form', { className: 'consolidate-review', onSubmit: submit }, h('fieldset', { disabled: busy },
            h('legend', { className: 'consolidate-block-title' }, 'Your decision'),
            h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Decision'),
                h('select', { className: 'ui-select', value: status, onChange: e => setStatus(e.target.value) },
                    ['Approved', 'Rejected'].map(value => h('option', { key: value, value },
                        value === 'Approved' ? 'Accept suggestion' : 'Decline suggestion')))),
            h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Reviewer remarks ', h('span', { className: 'ui-required' }, '*')),
                h('textarea', { className: 'ui-textarea', value: note, rows: 4, maxLength: 5000, required: true, onChange: e => setNote(e.target.value) }),
                h('span', { className: 'ui-help' }, 'Explain your decision and any changes made. Accepting an input does not automatically update the plan, objective or mapping.')),
            h('div', { className: 'consolidate-dialog-actions' },
                h('button', { type: 'button', className: 'ui-button ui-button--secondary', onClick: close }, 'Cancel'),
                h('button', { type: 'submit', className: 'ui-button ui-button--primary' }, busy ? 'Saving…' : 'Save decision')))))));
}

function SubmittedInputsApp() {
    const [activeTab, setActiveTab] = useState('office');
    const [officeView, setOfficeView] = useState('inputs');
    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({});
    const [filters, setFilters] = useState(initialFilters);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [selected, setSelected] = useState(null);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        let active = true;
        setLoading(true); setError(''); setRows([]); setMeta({});
        listSubmittedInputs({ ...filters, source: activeTab })
            .then(result => { if (active) { setRows(result.data); setMeta(result.meta); } })
            .catch(err => { if (active) setError(errorLabel(err)); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [filters, refresh, activeTab]);
    const changeFilter = (key, value) => setFilters(current => ({ ...current, [key]: value, ...(key === 'plan_id' ? { responsible_unit_id: '' } : {}), page: 1 }));
    const resetScope = () => setFilters(current => ({ ...emptyFilters, status: current.status }));
    const hasScope = scopeKeys.some(key => filters[key]);
    const switchSource = value => {
        setSelected(null);
        setNotice('');
        setFilters(initialFilters());
        setActiveTab(value);
        setOfficeView('inputs');
    };

    // Office / Management input sources: underline tabs, shown only when there is more than one source.
    const sources = [['office', 'Office Inputs', 'bi-building'], ...(can('management_objective_comments.view') ? [['management', 'Management Inputs', 'bi-person-badge']] : [])];
    const sourceTabs = sources.length > 1 ? h('nav', { className: 'consolidate-tabs', 'aria-label': 'Input source' },
        sources.map(([value, label, icon]) => h('button', {
            key: value,
            type: 'button',
            className: `consolidate-tab${activeTab === value ? ' is-active' : ''}`,
            'aria-pressed': activeTab === value,
            onClick: () => switchSource(value),
        }, h('i', { className: `bi ${icon}`, 'aria-hidden': true }), label))) : null;

        const showDocuments = activeTab === 'office'
    && officeView === 'documents'
    && can('implementation_inputs.review')
    && can('strategic_documents.view');

const officeTabs = activeTab === 'office'
    && can('implementation_inputs.review')
    && can('strategic_documents.view')
    && h('nav', {
        className: 'consolidate-tabs',
        'aria-label': 'Office contribution type',
    },
        [
            ['inputs', 'Suggestions & Feedback', 'bi-chat-left-text'],
            ['documents', 'Supporting Documents', 'bi-folder2-open'],
        ].map(([value, label, icon]) => h('button', {
            key: value,
            type: 'button',
            className: `consolidate-tab${officeView === value ? ' is-active' : ''}`,
            'aria-pressed': officeView === value,
            onClick: () => {
                setSelected(null);
                setNotice('');
                setOfficeView(value);
            },
        },
            h('i', { className: `bi ${icon}`, 'aria-hidden': true }),
            ' ',
            label
        ))
    );
    const summary = meta.summary || {};
    const total = Object.keys(statuses).reduce((sum, key) => sum + (summary[key] || 0), 0);
    const queueCards = h('section', { className: 'consolidate-queues', 'aria-label': 'Input review queues' },
        queues.map(([value, label, icon, tone]) => h('button', {
            key: label,
            type: 'button',
            className: `consolidate-queue is-${tone}${filters.status === value ? ' is-active' : ''}`,
            'aria-pressed': filters.status === value,
            onClick: () => changeFilter('status', value),
        },
        h('span', { className: 'consolidate-queue__icon' }, h('i', { className: `bi ${icon}`, 'aria-hidden': true })),
        h('span', { className: 'consolidate-queue__copy' },
            h('small', null, label),
            h('strong', null, loading || error ? '—' : value ? summary[value] || 0 : total)))));

    const select = (key, label, placeholder, options) => h('label', { key },
        h('span', null, label),
        h('select', { value: filters[key], disabled: loading, onChange: e => changeFilter(key, e.target.value) },
            h('option', { value: '' }, placeholder), options.map(([value, text]) => h('option', { key: value, value }, text))));
    const dateInput = (key, label) => h('label', { key },
        h('span', null, label),
        h('input', { type: 'date', value: filters[key], disabled: loading, onChange: e => changeFilter(key, e.target.value) }));
    const filterBar = h('section', { className: 'consolidate-filters', 'aria-label': 'Input filters' },
        select('plan_id', 'Strategic plan', 'All authorized plans', (meta.filters?.plans || []).map(p => [p.record_id, p.title])),
        activeTab === 'office' && select('responsible_unit_id', 'Office / Unit', 'All authorized offices',
            (meta.filters?.offices || [])
                .filter(o => o.responsible_unit_id != null)
                .map(o => [o.responsible_unit_id, o.responsible_office_agency])),
        select('feedback_category', 'Category', 'All categories', Object.entries(categories)),
        dateInput('submitted_from', 'Submitted from'),
        dateInput('submitted_to', 'Submitted to'),
        h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm consolidate-filters__reset', onClick: resetScope, disabled: !hasScope },
            h('i', { className: 'bi bi-arrow-counterclockwise', 'aria-hidden': true }), ' Reset filters'));

    const queueLabel = queues.find(([value]) => value === filters.status)?.[1] || 'All Inputs';
    const register = h('section', { className: 'consolidate-register', 'aria-busy': loading },
        h('header', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' },
                h('h2', null, activeTab === 'management' ? 'Management Objective Suggestions' : 'Office Suggestions & Feedback'),
                h('p', null, `${queueLabel} · ${loading ? 'loading…' : `${meta.total || 0} input${meta.total === 1 ? '' : 's'}`}`)),
            h('i', { className: `bi ${activeTab === 'management' ? 'bi-person-badge' : 'bi-inboxes'}`, 'aria-hidden': true })),
        error && h('p', { className: 'ui-status ui-status--error consolidate-register__error', role: 'alert' }, error, ' ',
            h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', onClick: () => setRefresh(refresh + 1) }, 'Retry')),
        h('div', { className: 'ui-table-wrap' }, h('table', { className: 'ui-table' },
            h('thead', null, h('tr', null, ['Submitted by', 'Strategic plan', 'Input type', 'Input', 'Status', 'Submitted at', 'Actions'].map(label => h('th', { scope: 'col', key: label }, label)))),
            h('tbody', null, loading ? h('tr', null, h('td', { colSpan: 7, className: 'consolidate-empty' }, 'Loading submitted inputs…'))
                : rows.length ? rows.map(row => h('tr', { key: row.input_id },
                    h('td', null, h('div', { className: 'consolidate-office' },
                        h('span', { className: 'consolidate-avatar' }, h('i', { className: 'bi bi-building', 'aria-hidden': true })),
                        h('span', null, row.responsible_office_agency, h('small', null, row.submitter_name)))),
                    h('td', null, row.strategic_plan.title, row.objective && h('small', null, row.objective.objective_title)),
                    h('td', null, categoryLabel(row), row.mapping_reference_title && h('small', null, mappingLabel(row))),
                    h('td', null, h('div', { className: 'consolidate-excerpt' }, row.content)),
                    h('td', null, statusBadge(row.review_status)),
                    h('td', { className: 'consolidate-date' }, dateCell(row.submitted_at)),
                    h('td', null, h('button', {
                        type: 'button',
                        className: `ui-button ui-button--sm ${row.can_review ? 'ui-button--primary' : 'ui-button--secondary'}`,
                        onClick: () => setSelected(row.input_id),
                        'aria-label': `${row.can_review ? 'Review' : 'View'} input ${row.input_id}`,
                    }, row.can_review ? 'Review' : 'View'))))
                    : h('tr', null, h('td', { colSpan: 7, className: 'consolidate-empty' },
                        h('i', { className: 'bi bi-inbox', 'aria-hidden': true }),
                        error ? 'Inputs could not be loaded.' : 'No submitted inputs match these filters.'))))),
        h('footer', { className: 'ui-pagination consolidate-pagination' },
            h('span', null, `Page ${filters.page} of ${meta.last_page || 1}`),
            h('div', { className: 'ui-pagination__actions' },
                h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', disabled: loading || filters.page <= 1, onClick: () => setFilters({ ...filters, page: filters.page - 1 }) },
                    h('i', { className: 'bi bi-chevron-left', 'aria-hidden': true }), ' Previous'),
                h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', disabled: loading || filters.page >= (meta.last_page || 1), onClick: () => setFilters({ ...filters, page: filters.page + 1 }) },
                    'Next ', h('i', { className: 'bi bi-chevron-right', 'aria-hidden': true })))));

    const objectiveComments = activeTab === 'management' && can('management_objective_comments.view')
        && h('details', { className: 'consolidate-comments' },
            h('summary', null,
                h('span', { className: 'ui-section-header__copy' },
                    h('h2', null, 'Objective Comments'),
                    h('p', null, 'Comments from Management on plan objectives. Expand to view and acknowledge them. Objective suggestions are listed in the register below.')),
                h('i', { className: 'bi bi-chevron-down', 'aria-hidden': true })),
            h('div', { className: 'consolidate-comments__body' }, h(ManagementObjectiveCommentsPanel)));

    return h('div', { className: 'office-workspace' }, h(AppSidebar, { onNotice: setNotice }),
        h('main', { className: 'office-content consolidate-content' },
            h('div', { className: 'app-shell-container' },
                h(PageHeader, { section: 'Planning Inputs', title: can('implementation_inputs.review') ? 'Planning Inputs' : 'Input Status', subtitle: 'View planning suggestions and their outcomes. Authorised reviewers can accept or decline inputs with remarks.' }),
              sourceTabs,
officeTabs,
notice && h('p', {
    className: 'ui-status ui-status--info',
    role: 'status',
}, notice),
objectiveComments,
showDocuments
    ? h(PlanSupportingDocumentsPanel)
    : h(React.Fragment, null, queueCards, filterBar, register)),
            selected && h(InputDialog, { key: selected, id: selected, close: () => setSelected(null), saved: () => {
                setSelected(null); setNotice('Input review saved.'); setRefresh(refresh + 1);
            } })));
}

const root = createPageRoot(document.getElementById('root'));
root.render(h('p', { role: 'status' }, 'Loading your access…'));
apiRequest('/api/auth/me').then(payload => {
    saveAccessSession(createAccessSession(payload.data));
    if (enforcePageAccess()) root.render(h(SubmittedInputsApp));
}).catch(error => root.render(h('p', { role: 'alert' }, error.message)));
