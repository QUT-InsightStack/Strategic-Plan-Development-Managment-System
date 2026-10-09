import { AppSidebar } from '../../components/AppSidebar.js';
import { AppDialog } from '../../components/AppDialog.js';
import { mountProtectedPage } from '../../access/mount-protected-page.js';
import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { apiRequest } from '../../api/api-client.js';
import { listPlanAlignments, addAlignments, archiveAlignment, restoreAlignment, deleteAlignment, updateAlignmentReference } from '../../api/strategic-alignments-api.js';

const h = React.createElement;
const readOnly = new URLSearchParams(location.search).get('mode') === 'view';
const describe = error => [error.message, ...Object.values(error.errors || {}).flat()].filter(Boolean).join(' ');
const typeName = type => type === 'pdp-chapter' ? 'PDP Chapter' : 'Presidential Agenda';

export function MappingApp() {
    const [plans, setPlans] = React.useState([]);
    const [planId, setPlanId] = React.useState('');
    const [data, setData] = React.useState(null);
    const [revision, refresh] = React.useState(0);
    const [status, setStatus] = React.useState('active');
    const [loading, setLoading] = React.useState(true);
    const [busy, setBusy] = React.useState(false);
    const [notice, setNotice] = React.useState('');
    const [error, setError] = React.useState('');
    const [objectiveId, setObjectiveId] = React.useState('');
    const [type, setType] = React.useState('pdp-chapter');
    const [referenceId, setReferenceId] = React.useState('');
    const [action, setAction] = React.useState(null);
    const [reason, setReason] = React.useState('');
    const [editing, setEditing] = React.useState(null);
    const [details, setDetails] = React.useState({ document_id: '', reference_section: '', page_paragraph: '', note: '' });
    const [documents, setDocuments] = React.useState([]);

    React.useEffect(() => {
        let active = true;
        (async () => {
            try {
                const rows = []; let page = 1; let last = 1;
                do {
                    const result = await listStrategicPlans({ page, per_page: 100 });
                    rows.push(...(result.data || []).filter(plan => !['archived', 'deleted'].includes(plan.status))); last = result.meta?.last_page || 1; page++;
                } while (page <= last);
                if (!active) return;
                setPlans(rows);
                const requested = new URLSearchParams(location.search).get('plan_id');
                if (requested && !rows.some(plan => String(plan.record_id) === requested)) {
                    setError('The requested plan is unavailable in your mapping scope. Select an available plan.');
                    setLoading(false);
                    return;
                }
                setPlanId(requested || String(rows[0]?.record_id || ''));
                if (!rows.length) setLoading(false);
            } catch (err) { if (active) { setError(describe(err)); setLoading(false); } }
        })();
        return () => { active = false; };
    }, []);

    React.useEffect(() => {
        if (!planId) return;
        let active = true;
        setLoading(true); setData(null);
        listPlanAlignments(planId).then(result => { if (active) setData(result); })
            .catch(err => { if (active) setError(describe(err)); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [planId, revision]);

    const capabilities = data?.meta?.capabilities || {};
    const allowed = name => !readOnly && Boolean(capabilities[name]);
    const showArchived = status === 'archived' && (allowed('archive') || allowed('delete'));
    const rows = (data?.data || []).filter(mapping => mapping.status === (showArchived ? 'archived' : 'active'));
    const choices = type === 'pdp-chapter' ? data?.meta?.catalog?.pdp_chapters || [] : data?.meta?.catalog?.presidential_agenda || [];
    const canChange = mapping => !['archived', 'deleted'].includes(mapping.objective_status);

    async function mutate(task, message) {
        if (busy) return;
        setBusy(true); setError(''); setNotice('');
        try { await task(); setEditing(null); setNotice(message); refresh(value => value + 1); }
        catch (err) { setError(describe(err)); refresh(value => value + 1); }
        finally { setBusy(false); }
    }
    function add(event) {
        event.preventDefault();
        const key = type === 'pdp-chapter' ? 'pdp_chapter_ids' : 'presidential_agenda_item_ids';
        mutate(() => addAlignments(Number(objectiveId), { [key]: [Number(referenceId)] }), 'Alignment saved.');
    }
    React.useEffect(() => {
        if (!editing) return;
        let active = true;
        setDocuments([]);
        (async () => { try {
            const rows = [];
            for (const target of [`strategic-plans/${planId}`, `strategic-objectives/${editing.objective_id}`]) {
                let page = 1; let last = 1;
                do {
                    const result = await apiRequest(`/api/${target}/documents?page=${page}`);
                    rows.push(...(result.data || [])); last = result.meta?.last_page || 1; page++;
                } while (page <= last);
            }
            if (active) setDocuments(rows);
        } catch (err) { if (active) setError(describe(err)); } })();
        return () => { active = false; };
    }, [editing, planId]);
    function editReference(mapping) {
        setEditing(mapping); setDetails({ document_id: '', page_paragraph: '', note: '', ...mapping.reference_details, reference_section: mapping.reference_details?.reference_section || mapping.reference_details?.section || '' });
    }
    function confirm() {
        const selected = action; if (!selected || busy) return;
        if (selected.kind === 'delete' && !reason.trim()) return;
        setAction(null);
        const requests = { archive: () => archiveAlignment(selected.mapping), restore: () => restoreAlignment(selected.mapping), delete: () => deleteAlignment(selected.mapping, reason.trim()) };
        mutate(requests[selected.kind], `Alignment ${selected.kind === 'delete' ? 'deleted' : selected.kind === 'archive' ? 'archived' : 'restored'}.`);
    }
    const button = (label, onClick, disabled = false) => h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', disabled: busy || disabled, onClick }, label);
    const actionButton = (mapping, kind) => button(kind[0].toUpperCase() + kind.slice(1), () => { setReason(''); setAction({ mapping, kind }); });
    return h(React.Fragment, null, h(AppSidebar), h('main', { className: 'app-shell-main mapping-page' }, h('div', { className: 'app-shell-container mapping-container' },
        h('header', { className: 'mapping-header' }, h('h1', null, 'Strategic Alignment Mappings'), h('p', null, 'Link objectives to PDP chapters and Presidential Agenda items.')),
        h('label', { className: 'ui-field' }, 'Strategic plan', h('select', { className: 'ui-select', value: planId, disabled: busy, onChange: event => { setPlanId(event.target.value); setObjectiveId(''); setReferenceId(''); setNotice(''); setError(''); setEditing(null); setAction(null); } },
            h('option', { value: '', disabled: true }, 'Select a strategic plan'),
            plans.map(plan => h('option', { key: plan.record_id, value: plan.record_id }, plan.title)))),
        notice && h('p', { className: 'ui-status ui-status--success', role: 'status' }, notice),
        error && h('p', { className: 'ui-status ui-status--error', role: 'alert' }, error),
        loading ? h('p', { role: 'status' }, 'Loading alignments...') : !planId ? h('p', null, 'No plans are available in your scope.') : h(React.Fragment, null,
            !readOnly && data && !Object.values(capabilities).some(Boolean) && h('p', null, 'These alignments are read-only for your permissions or the current plan status.'),
            allowed('create') && h('form', { className: 'ui-card mapping-step', onSubmit: add }, h('h2', null, 'Add alignment'),
                h('label', { className: 'ui-field' }, 'Objective', h('select', { required: true, className: 'ui-select', value: objectiveId, disabled: busy, onChange: event => setObjectiveId(event.target.value) }, h('option', { value: '' }, 'Select objective'),
                    (data?.meta?.objectives || []).filter(item => !['archived', 'deleted'].includes(item.status)).map(item => h('option', { key: item.objective_id, value: item.objective_id }, item.objective_title)))),
                h('label', { className: 'ui-field' }, 'Reference type', h('select', { className: 'ui-select', value: type, disabled: busy, onChange: event => { setType(event.target.value); setReferenceId(''); } }, h('option', { value: 'pdp-chapter' }, 'PDP Chapter'), h('option', { value: 'presidential-agenda' }, 'Presidential Agenda'))),
                h('label', { className: 'ui-field' }, 'Reference', h('select', { required: true, className: 'ui-select', value: referenceId, disabled: busy, onChange: event => setReferenceId(event.target.value) }, h('option', { value: '' }, 'Select reference'), choices.map(item => h('option', { key: item.chapter_id || item.agenda_id, value: item.chapter_id || item.agenda_id }, item.chapter_title || `${item.code} - ${item.title}`)))),
                h('button', { className: 'ui-button ui-button--primary', disabled: busy || !objectiveId || !referenceId }, 'Add alignment')),
            (allowed('archive') || allowed('delete')) && h('div', { className: 'mapping-tabs', role: 'group', 'aria-label': 'Mapping status' }, ['active', 'archived'].map(value => button(`${value === 'active' ? 'Active' : 'Archived'} (${(data?.data || []).filter(item => item.status === value).length})`, () => setStatus(value), status === value))),
            h('div', { className: 'ui-table-wrap' }, h('table', { className: 'ui-table' },
                h('thead', null, h('tr', null, ['Objective', 'Type', 'Reference', 'Office / Unit', 'Reference notes', ...(showArchived ? ['Archived'] : []), 'Actions'].map(label => h('th', { key: label }, label)))),
                h('tbody', null, rows.length ? rows.map(mapping => h('tr', { key: mapping.id },
                    h('td', null, mapping.objective_title), h('td', null, typeName(mapping.type)), h('td', null, mapping.reference_title), h('td', null, mapping.responsible_office_agency || 'Unassigned'),
                    h('td', null, [mapping.reference_details?.reference_section || mapping.reference_details?.section, mapping.reference_details?.page_paragraph, mapping.reference_details?.note].filter(Boolean).join(' / ') || '-'),
                    showArchived && h('td', null, `${mapping.archived_at ? new Date(mapping.archived_at).toLocaleString() : '—'}${mapping.archived_by_name || mapping.archived_by ? ` by ${mapping.archived_by_name || mapping.archived_by}` : ''}`),
                    h('td', null, h('div', { className: 'mapping-actions' },
                        canChange(mapping) && mapping.status === 'active' && allowed('archive') && actionButton(mapping, 'archive'),
                        mapping.status === 'archived' && allowed('restore') && actionButton(mapping, 'restore'),
                        canChange(mapping) && mapping.status === 'active' && allowed('delete') && actionButton(mapping, 'delete'),
                        canChange(mapping) && mapping.status === 'active' && allowed('reference') && button('Reference details', () => editReference(mapping)))))) : h('tr', null, h('td', { colSpan: showArchived ? 7 : 6 }, `No ${showArchived ? 'archived' : 'active'} mappings.`))))),
            editing && allowed('reference') && (data?.data || []).some(mapping => mapping.id === editing.id && mapping.status === 'active') && h('form', { className: 'ui-card mapping-step', onSubmit: event => { event.preventDefault(); mutate(() => updateAlignmentReference(editing, { ...details, document_id: details.document_id ? Number(details.document_id) : null }), 'Reference details saved.'); } },
                h('h2', null, `Reference: ${editing.reference_title}`),
                h('label', { className: 'ui-field' }, 'Uploaded Reference File', h('select', { className: 'ui-select', required: true, disabled: busy, value: details.document_id || '', onChange: event => setDetails({ ...details, document_id: event.target.value }) }, h('option', { value: '' }, 'Select uploaded reference file'), documents.map(document => h('option', { key: document.document_id, value: document.document_id }, document.original_filename)))),
                h('label', { className: 'ui-field' }, 'Reference Chapter / Section', h('input', { className: 'ui-input', required: true, disabled: busy, value: details.reference_section || '', onChange: event => setDetails({ ...details, reference_section: event.target.value }) })),
                h('label', { className: 'ui-field' }, 'Page / Paragraph (Optional)', h('input', { className: 'ui-input', disabled: busy, value: details.page_paragraph || '', onChange: event => setDetails({ ...details, page_paragraph: event.target.value }) })),
                h('label', { className: 'ui-field' }, 'Notes', h('textarea', { className: 'ui-textarea', disabled: busy, maxLength: 2000, value: details.note || '', onChange: event => setDetails({ ...details, note: event.target.value }) })),
                h('button', { className: 'ui-button ui-button--primary', disabled: busy }, 'Save reference'), button('Cancel', () => setEditing(null)))
        ),
        h(AppDialog, { open: Boolean(action), variant: 'danger', title: action ? `${action.kind[0].toUpperCase() + action.kind.slice(1)} alignment?` : '',
            message: action ? `${action.mapping.objective_title} - ${action.mapping.reference_title}. ${action.kind === 'delete' ? 'Permanent deletion cannot be undone. Provide a reason.' : 'The objective and referenced item will be retained.'}` : '',
            confirmLabel: 'Confirm', confirmDisabled: busy || (action?.kind === 'delete' && !reason.trim()), onConfirm: confirm, onCancel: () => setAction(null) },
            action?.kind === 'delete' && h('label', { className: 'ui-field' }, 'Deletion reason', h('textarea', { className: 'ui-textarea', required: true, maxLength: 1000, value: reason, onChange: event => setReason(event.target.value) })))
    )));
}

mountProtectedPage(document.getElementById('root'), () => h(MappingApp));
