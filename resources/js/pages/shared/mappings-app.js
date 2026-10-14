import { AppSidebar } from '../../components/AppSidebar.js';
import { AppDialog } from '../../components/AppDialog.js';
import { mountProtectedPage } from '../../access/mount-protected-page.js';
import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { apiRequest } from '../../api/api-client.js';
import { listPlanAlignments, addAlignments, archiveAlignment, restoreAlignment, deleteAlignment, updateAlignmentReference } from '../../api/strategic-alignments-api.js';

const h = React.createElement;
const readOnly = new URLSearchParams(location.search).get('mode') === 'view';
const describe = error => [error.message, ...Object.values(error.errors || {}).flat()].filter(Boolean).join(' ');

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
    const [selected, setSelected] = React.useState({ agendas: [], pdp: [], objectives: [] });
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
    const activeCount = (data?.data || []).filter(mapping => mapping.status === 'active').length;
    const archivedCount = (data?.data || []).filter(mapping => mapping.status === 'archived').length;
    const catalog = data?.meta?.catalog || {};
    const groups = [...rows.reduce((map, row) => {
        const group = map.get(row.objective_id) || { objective: row, links: [] };
        group.links.push(row); map.set(row.objective_id, group); return map;
    }, new Map()).values()];
    const canChange = mapping => !['archived', 'deleted'].includes(mapping.objective_status);

    async function mutate(task, message) {
        if (busy) return;
        setBusy(true); setError(''); setNotice('');
        try { await task(); setEditing(null); setNotice(message); refresh(value => value + 1); }
        catch (err) { setError(describe(err)); refresh(value => value + 1); }
        finally { setBusy(false); }
    }
    function toggle(group, id) {
        setSelected(current => ({ ...current, [group]: current[group].includes(id) ? current[group].filter(value => value !== id) : [...current[group], id] }));
    }
    async function add(event) {
        event.preventDefault();
        if (busy || !allowed('create') || !selected.objectives.length || !selected.agendas.length || !selected.pdp.length) return;
        setBusy(true); setError(''); setNotice('');
        let saved = 0;
        try {
            for (const id of selected.objectives) {
                await addAlignments(Number(id), { pdp_chapter_ids: selected.pdp.map(Number), presidential_agenda_item_ids: selected.agendas.map(Number) });
                saved += 1;
            }
            setSelected({ agendas: [], pdp: [], objectives: [] });
            setNotice(`Mappings saved for ${saved} objective(s).`);
        } catch (err) {
            setError(`${saved} of ${selected.objectives.length} objective(s) saved. ${describe(err)} Review the refreshed preview before retrying.`);
        } finally { setBusy(false); refresh(value => value + 1); }
    }
    function choiceLevel(title, icon, items, group, idKey, titleKey) {
        return h('section', { className: 'mapping-level' }, h('h3', null, h('i', { className: `bi ${icon}`, 'aria-hidden': true }), title),
            h('div', { className: 'mapping-options' }, items.length ? items.map(item => h('label', { key: item[idKey], className: 'mapping-option' },
                h('input', { type: 'checkbox', disabled: busy, checked: selected[group].includes(item[idKey]), onChange: () => toggle(group, item[idKey]) }),
                h('span', null, item[titleKey]))) : h('p', { className: 'mapping-empty' }, `No ${title.toLowerCase()} available.`)));
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
        h('header', { className: 'mapping-header' }, h('h1', null, readOnly ? 'Strategic Alignment Overview' : 'Planner Plan Mapping'), h('p', null, 'Map Agenda items and PDP elements to DOST objectives, then link supporting reference sections.')),
        h('section', { className: 'ui-card mapping-context' }, h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Strategic Plan'), h('select', { className: 'ui-select', value: planId, disabled: busy, onChange: event => { setPlanId(event.target.value); setSelected({ agendas: [], pdp: [], objectives: [] }); setNotice(''); setError(''); setEditing(null); setAction(null); } },
            h('option', { value: '', disabled: true }, 'Select a strategic plan'),
            plans.map(plan => h('option', { key: plan.record_id, value: plan.record_id }, plan.title))))),
        !readOnly && planId && data && !loading && h(
    'div',
   { className: 'mapping-navigation-actions' },
    h(
        'a',
        {
            className: 'ui-button ui-button--secondary ui-button--sm',
            href: `/strategic-plans/${planId}/objectives`,
            onClick: event => {
                if (busy) event.preventDefault();
            },
            'aria-disabled': busy,
        },
        'Back to Objectives'
    ),
    h(
        'a',
        {
            className: 'ui-button ui-button--primary ui-button--sm',
            href: `/strategic-plans/${planId}/overview`,
            onClick: event => {
                if (busy) event.preventDefault();
            },
            'aria-disabled': busy,
        },
        'Review Plan'
    )
),
            notice && h('p', { className: 'ui-status ui-status--success', role: 'status' }, notice),
        error && h('p', { className: 'ui-status ui-status--error', role: 'alert' }, error),
        loading ? h('p', { role: 'status' }, 'Loading alignments...') : !planId ? h('p', null, 'No plans are available in your scope.') : h(React.Fragment, null,
            !readOnly && data && !Object.values(capabilities).some(Boolean) && h('p', null, 'These alignments are read-only for your permissions or the current plan status.'),
            allowed('create') && h('form', { className: 'ui-card mapping-step mapping-hierarchy-step', onSubmit: add },
                h('div', { className: 'mapping-step__heading' }, h('span', null, '1'), h('h2', null, 'Step 1. Create Three-Level Mapping')),
                h('div', { className: 'mapping-levels' },
                    choiceLevel('Agenda', 'bi-bank2', catalog.presidential_agenda || [], 'agendas', 'agenda_id', 'title'),
                    h('i', { className: 'bi bi-arrow-right mapping-arrow', 'aria-hidden': true }),
                    choiceLevel('PDP Elements', 'bi-file-earmark-text-fill', catalog.pdp_chapters || [], 'pdp', 'chapter_id', 'chapter_title'),
                    h('i', { className: 'bi bi-arrow-right mapping-arrow', 'aria-hidden': true }),
                    choiceLevel('DOST Objectives', 'bi-bullseye', (data?.meta?.objectives || []).filter(item => !['archived', 'deleted'].includes(item.status)), 'objectives', 'objective_id', 'objective_title')),
                h('div', { className: 'mapping-hierarchy-action' }, h('button', { className: 'ui-button ui-button--primary ui-button--sm', disabled: busy || !selected.objectives.length || !selected.agendas.length || !selected.pdp.length }, busy ? 'Saving…' : '+ Add Hierarchical Mapping'))),
            h('section', { className: 'ui-card mapping-preview-card' },
                h('div', { className: 'mapping-preview-card__header' }, h('h2', null, 'Three-level Mapping Preview'),
                    (allowed('archive') || allowed('delete')) && h('div', { className: 'mapping-tabs', role: 'group', 'aria-label': 'Mapping status' }, ['active', 'archived'].map(value => button(`${value === 'active' ? 'Active' : 'Archived'} (${value === 'active' ? activeCount : archivedCount})`, () => setStatus(value), status === value)))),
                h('div', { className: 'mapping-preview' }, h('table', { className: 'ui-table' },
                    h('thead', null, h('tr', null, ['Agenda', 'PDP Element', 'DOST Objective', 'Agency Plan', 'Action'].map(label => h('th', { key: label, scope: 'col' }, label)))),
                    h('tbody', null, groups.length ? groups.map(group => h('tr', { key: group.objective.objective_id },
                        h('td', null, group.links.filter(link => link.type === 'presidential-agenda').map(link => link.reference_title).join('; ') || 'Not linked'),
                        h('td', null, group.links.filter(link => link.type === 'pdp-chapter').map(link => link.reference_title).join('; ') || 'Not linked'),
                        h('td', null, group.objective.objective_title), h('td', null, group.objective.agency_plan?.title || group.objective.responsible_office_agency || 'Not assigned'),
                        h('td', null, h('details', { className: 'mapping-link-actions' }, h('summary', null, 'Manage links'), group.links.map(mapping => h('div', { className: 'mapping-link-action', key: mapping.id },
                            h('small', null, `${mapping.type === 'pdp-chapter' ? 'PDP' : 'Agenda'}: ${mapping.reference_title}`),
                            h('div', { className: 'mapping-actions' },
                                canChange(mapping) && mapping.status === 'active' && allowed('reference') && button('Reference', () => editReference(mapping)),
                                canChange(mapping) && mapping.status === 'active' && allowed('archive') && actionButton(mapping, 'archive'),
                                mapping.status === 'archived' && allowed('restore') && actionButton(mapping, 'restore'),
                                canChange(mapping) && mapping.status === 'active' && allowed('delete') && actionButton(mapping, 'delete'))))))))
                        : h('tr', null, h('td', { colSpan: 5 }, `No ${showArchived ? 'archived' : 'active'} mappings.`))))),
                h('p', { className: 'mapping-count' }, `${groups.length} objective mapping group(s). Agenda and PDP associations are grouped by objective.`)),
            allowed('reference') && h('section', { className: 'ui-card mapping-reference-step' },
                h('div', { className: 'mapping-step__heading' }, h('span', null, '2'), h('h2', null, 'Step 2. Link the Mapping to Uploaded Reference Sections')),
                h('div', { className: 'mapping-reference-layout' },
                    h('aside', { className: 'mapping-selected-panel' }, h('h3', null, 'Selected Hierarchical Mapping'), h('small', null, 'Choose an existing hierarchical mapping'),
                        h('label', { className: 'mapping-search-select' }, h('span', { className: 'ui-label' }, 'Search mapping'),
                            h('select', { value: editing?.id || '', disabled: busy, onChange: event => {
                                const mapping = (data?.data || []).find(item => String(item.id) === event.target.value);
                                if (mapping) editReference(mapping); else setEditing(null);
                            } }, h('option', { value: '' }, 'Select mapping'),
                            (data?.data || []).filter(item => item.status === 'active' && canChange(item)).map(item => h('option', { key: item.id, value: item.id }, `${item.type === 'pdp-chapter' ? 'PDP' : 'Agenda'} · ${item.reference_title} · ${item.objective_title}`)))),
                        editing && h('div', { className: 'mapping-selected-chain' },
                            h('article', { className: 'is-pdp' }, h('i', { className: 'bi bi-file-earmark-text-fill', 'aria-hidden': true }), h('div', null, h('small', null, 'PDP Element'), h('strong', null, (data?.data || []).filter(item => String(item.objective_id) === String(editing.objective_id) && item.type === 'pdp-chapter' && item.status === 'active').map(item => item.reference_title).join(', ') || 'Not linked'))),
                            h('article', { className: 'is-dost' }, h('i', { className: 'bi bi-bullseye', 'aria-hidden': true }), h('div', null, h('small', null, 'DOST Objective'), h('strong', null, editing.objective_title))),
                            h('article', { className: 'is-agency' }, h('i', { className: 'bi bi-building', 'aria-hidden': true }), h('div', null, h('small', null, 'Agency Plan'), h('strong', null, editing.agency_plan?.title || editing.responsible_office_agency || 'Not assigned'))))),
                    h('form', { onSubmit: event => {
                        event.preventDefault();
                        if (!editing || !(data?.data || []).some(item => item.id === editing.id && item.status === 'active')) return;
                        mutate(() => updateAlignmentReference(editing, { ...details, document_id: details.document_id ? Number(details.document_id) : null }), 'Reference details saved.');
                    } }, h('fieldset', { className: 'mapping-reference-form', disabled: busy || !editing || !(data?.data || []).some(item => item.id === editing.id && item.status === 'active') },
                        h('legend', null, 'Reference Section Details'),
                h('label', { className: 'ui-field' }, 'Uploaded Reference File', h('select', { className: 'ui-select', required: true, disabled: busy, value: details.document_id || '', onChange: event => setDetails({ ...details, document_id: event.target.value }) }, h('option', { value: '' }, 'Select uploaded reference file'), documents.map(document => h('option', { key: document.document_id, value: document.document_id }, document.original_filename)))),
                h('label', { className: 'ui-field' }, 'Reference Chapter / Section', h('input', { className: 'ui-input', required: true, disabled: busy, value: details.reference_section || '', onChange: event => setDetails({ ...details, reference_section: event.target.value }) })),
                h('label', { className: 'ui-field' }, 'Page / Paragraph (Optional)', h('input', { className: 'ui-input', disabled: busy, value: details.page_paragraph || '', onChange: event => setDetails({ ...details, page_paragraph: event.target.value }) })),
                h('label', { className: 'ui-field' }, 'Notes', h('textarea', { className: 'ui-textarea', disabled: busy, maxLength: 2000, value: details.note || '', onChange: event => setDetails({ ...details, note: event.target.value }) })),
                h('button', { className: 'ui-button ui-button--primary', disabled: busy }, '+ Add Reference Mapping'), button('Clear selection', () => setEditing(null))))))
        ),
        h(AppDialog, { open: Boolean(action), variant: 'danger', title: action ? `${action.kind[0].toUpperCase() + action.kind.slice(1)} alignment?` : '',
            message: action ? `${action.mapping.objective_title} - ${action.mapping.reference_title}. ${action.kind === 'delete' ? 'Permanent deletion cannot be undone. Provide a reason.' : 'The objective and referenced item will be retained.'}` : '',
            confirmLabel: 'Confirm', confirmDisabled: busy || (action?.kind === 'delete' && !reason.trim()), onConfirm: confirm, onCancel: () => setAction(null) },
            action?.kind === 'delete' && h('label', { className: 'ui-field' }, 'Deletion reason', h('textarea', { className: 'ui-textarea', required: true, maxLength: 1000, value: reason, onChange: event => setReason(event.target.value) })))
    )));
}

mountProtectedPage(document.getElementById('root'), () => h(MappingApp));
