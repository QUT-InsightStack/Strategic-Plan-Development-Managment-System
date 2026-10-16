import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { AppDialog } from '../../components/AppDialog.js';
import { mountProtectedPage } from '../../access/mount-protected-page.js';
import { can, getAccessSession } from '../../access/access-session.js';
import { isManagementSession } from '../../access/management-access.js';
import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { apiRequest } from '../../api/api-client.js';
import { listPlanAlignments, addAlignments, archiveAlignment, restoreAlignment, deleteAlignment, updateAlignmentReference } from '../../api/strategic-alignments-api.js';

const h = React.createElement;
const readOnly = new URLSearchParams(location.search).get('mode') === 'view';
const describe = error => [error.message, ...Object.values(error.errors || {}).flat()].filter(Boolean).join(' ');
const PAGE_SIZE = 10;
const EMPTY_DETAILS = { document_id: '', reference_section: '', page_paragraph: '', note: '' };

// The server does not list the chapters or sections inside an uploaded file
// yet, so these placeholders keep Step 2 usable until that endpoint exists.
const PLACEHOLDER_SECTIONS = [
    'Chapter 1 - Introduction',
    'Chapter 2 - Situation Analysis',
    'Chapter 3 - Strategic Framework',
    'Chapter 4 - Implementation Plan',
    'Chapter 5 - Monitoring and Evaluation',
];

const unique = values => [...new Set(values.filter(Boolean))];
const agencyTitle = item => item?.agency_plan?.title || item?.responsible_office_agency || '';

/*
 * The server stores Agenda and PDP links separately on each DOST objective.
 * A hierarchical mapping is one Agenda + PDP pair, with every objective that
 * carries both links listed against it.
 */
function buildHierarchy(links, objectives = []) {
    const byObjective = new Map();
    links.filter(link => link.status === 'active').forEach(link => {
        const entry = byObjective.get(link.objective_id) || { objective: link, agendas: [], pdps: [] };
        (link.type === 'pdp-chapter' ? entry.pdps : entry.agendas).push(link);
        byObjective.set(link.objective_id, entry);
    });
    const rows = new Map();
    byObjective.forEach(({ objective, agendas, pdps }) => {
        const meta = objectives.find(item => String(item.objective_id) === String(objective.objective_id));
        (agendas.length ? agendas : [null]).forEach(agenda => (pdps.length ? pdps : [null]).forEach(pdp => {
            const key = `${agenda?.reference_id ?? '-'}|${pdp?.reference_id ?? '-'}`;
            const row = rows.get(key) || { key, agenda, pdp, objectives: [] };
            row.objectives.push({
                objective_id: objective.objective_id, objective_title: objective.objective_title,
                objective_status: objective.objective_status, agency: agencyTitle(meta) || agencyTitle(objective),
                agendaLink: agenda, pdpLink: pdp, agendaCount: agendas.length, pdpCount: pdps.length,
            });
            rows.set(key, row);
        }));
    });
    return [...rows.values()];
}

/*
 * Links to archive so a row disappears while the objective's other rows stay
 * where possible. When an objective has several Agenda and PDP links, removing
 * one pair also drops the other pairs that share its PDP link; the dialog
 * lists every link so the user sees that before confirming.
 */
function linksToRemove(row) {
    return row.objectives.flatMap(item => {
        if (!item.agendaLink) return [item.pdpLink];
        if (!item.pdpLink) return [item.agendaLink];
        if (item.agendaCount === 1 && item.pdpCount === 1) return [item.agendaLink, item.pdpLink];
        if (item.agendaCount === 1) return [item.pdpLink];
        if (item.pdpCount === 1) return [item.agendaLink];
        return [item.pdpLink];
    });
}

const rowLabel = row => `${row.agenda?.reference_title || 'No agenda'} · ${row.pdp?.reference_title || 'No PDP element'} · ${row.objectives.map(item => item.objective_title).join(', ')}`;
const linkLabel = link => `${link.type === 'pdp-chapter' ? 'PDP' : 'Agenda'} "${link.reference_title}" on ${link.objective_title}`;

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
    const [selected, setSelected] = React.useState({ agenda: '', pdp: '', objectives: [] });
    const [action, setAction] = React.useState(null);
    const [reason, setReason] = React.useState('');
    const [editingKey, setEditingKey] = React.useState('');
    const [details, setDetails] = React.useState(EMPTY_DETAILS);
    const [documents, setDocuments] = React.useState([]);
    const [page, setPage] = React.useState(1);

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
    const canRemove = allowed('archive') || allowed('delete');
    const showArchived = status === 'archived' && canRemove;
    const links = data?.data || [];
    const objectives = (data?.meta?.objectives || []).filter(item => !['archived', 'deleted'].includes(item.status));
    const catalog = data?.meta?.catalog || {};
    const canChange = link => !['archived', 'deleted'].includes(link.objective_status);
    const hierarchy = buildHierarchy(links.filter(canChange), data?.meta?.objectives || []);
    const archivedLinks = links.filter(link => link.status === 'archived');
    const pageCount = Math.max(1, Math.ceil(hierarchy.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const visibleRows = hierarchy.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const editing = hierarchy.find(row => row.key === editingKey) || null;
    const editingLinks = editing ? editing.objectives.map(item => item.pdpLink || item.agendaLink) : [];

    async function mutate(task, message) {
        if (busy) return;
        setBusy(true); setError(''); setNotice('');
        try { await task(); setNotice(message); refresh(value => value + 1); }
        catch (err) { setError(describe(err)); refresh(value => value + 1); }
        finally { setBusy(false); }
    }
    function toggleObjective(id) {
        setSelected(current => ({ ...current, objectives: current.objectives.includes(id) ? current.objectives.filter(value => value !== id) : [...current.objectives, id] }));
    }
    const ready = selected.agenda !== '' && selected.pdp !== '' && selected.objectives.length > 0;
    async function add(event) {
        event.preventDefault();
        if (busy || !allowed('create') || !ready) return;
        setBusy(true); setError(''); setNotice('');
        let saved = 0;
        try {
            for (const id of selected.objectives) {
                const payload = { pdp_chapter_ids: [], presidential_agenda_item_ids: [] };
                for (const [type, field, referenceId] of [['presidential-agenda', 'presidential_agenda_item_ids', selected.agenda], ['pdp-chapter', 'pdp_chapter_ids', selected.pdp]]) {
                    const existing = links.find(link => String(link.objective_id) === String(id) && link.type === type && String(link.reference_id) === String(referenceId));
                    if (existing?.status === 'archived') await restoreAlignment(existing);
                    else if (!existing) payload[field].push(Number(referenceId));
                }
                if (payload.pdp_chapter_ids.length || payload.presidential_agenda_item_ids.length) await addAlignments(Number(id), payload);
                saved += 1;
            }
            setSelected({ agenda: '', pdp: '', objectives: [] });
            setNotice(`Hierarchical mapping saved for ${saved} objective(s).`);
        } catch (err) {
            setError(`${saved} of ${selected.objectives.length} objective(s) saved. ${describe(err)} Review the refreshed preview before retrying.`);
        } finally { setBusy(false); refresh(value => value + 1); }
    }
    function choiceLevel(title, icon, tone, items, idKey, titleKey, multiple, empty) {
        const field = idKey === 'agenda_id' ? 'agenda' : 'pdp';
        const isChecked = id => multiple ? selected.objectives.includes(id) : selected[field] === id;
        const choose = id => multiple ? toggleObjective(id) : setSelected(current => ({ ...current, [field]: id }));
        const count = multiple ? selected.objectives.length : selected[field] ? 1 : 0;
        return h('fieldset', { className: `mapping-level mapping-level--${tone}` },
            h('legend', { className: 'ui-visually-hidden' }, title),
            h('div', { className: 'mapping-level__header', 'aria-hidden': true },
                h('span', { className: 'mapping-level__icon' }, h('i', { className: `bi ${icon}` })),
                h('div', null, h('h3', null, title), h('small', null, multiple ? 'Choose one or more' : 'Choose one')),
                count > 0 && h('span', { className: 'mapping-level__count' }, `${count} selected`)),
            items.length ? h('div', { className: 'mapping-options' }, items.map(item => {
                const id = String(item[idKey]);
                return h('label', { key: id, className: `mapping-option${isChecked(id) ? ' is-checked' : ''}` },
                    h('input', { type: multiple ? 'checkbox' : 'radio', name: `mapping-${idKey}`, disabled: busy, checked: isChecked(id), onChange: () => choose(id) }),
                    h('span', { className: 'mapping-option__text' }, item.code && h('small', null, item.code), item[titleKey]));
            })) : h('div', { className: 'mapping-level__empty' },
                h('i', { className: 'bi bi-inbox', 'aria-hidden': true }),
                h('p', null, empty?.message || `No ${title.toLowerCase()} available.`),
                empty?.href && h('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: empty.href }, empty.label)));
    }

    React.useEffect(() => {
        if (!editingKey || !planId) return;
        let active = true;
        setDocuments([]);
        (async () => { try {
            const rows = [];
            const targets = [`strategic-plans/${planId}`, ...unique(editingLinks.map(link => String(link.objective_id))).map(id => `strategic-objectives/${id}`)];
            for (const target of targets) {
                let page = 1; let last = 1;
                do {
                    const result = await apiRequest(`/api/${target}/documents?page=${page}`);
                    rows.push(...(result.data || [])); last = result.meta?.last_page || 1; page++;
                } while (page <= last);
            }
            if (active) setDocuments(rows.filter((document, index) => rows.findIndex(other => other.document_id === document.document_id) === index));
        } catch (err) { if (active) setError(describe(err)); } })();
        return () => { active = false; };
    }, [editingKey, planId]);

    function selectMapping(key) {
        setEditingKey(key);
        const row = hierarchy.find(item => item.key === key);
        const saved = row?.objectives.map(item => (item.pdpLink || item.agendaLink)?.reference_details).find(value => value && Object.keys(value).length) || {};
        setDetails({ ...EMPTY_DETAILS, ...saved, document_id: saved.document_id ? String(saved.document_id) : '', reference_section: saved.reference_section || saved.section || '' });
    }
    function saveReference(event) {
        event.preventDefault();
        if (!editing || busy) return;
        const payload = { ...details, document_id: details.document_id ? Number(details.document_id) : null };
        mutate(async () => { for (const link of editingLinks) await updateAlignmentReference(link, payload); }, 'Reference details saved.');
    }
    function confirm() {
        const current = action; if (!current || busy) return;
        if (current.kind === 'delete' && !reason.trim()) return;
        setAction(null);
        if (current.kind === 'restore') {
            mutate(() => restoreAlignment(current.link), 'Mapping restored.');
            return;
        }
        const remove = allowed('archive') ? link => archiveAlignment(link) : link => deleteAlignment(link, reason.trim());
        mutate(async () => { for (const link of current.links) await remove(link); },
            allowed('archive') ? 'Mapping removed. Its links are kept under Archived.' : 'Mapping removed.');
        if (current.row.key === editingKey) setEditingKey('');
    }
    function requestRemove(row) {
        setReason('');
        setAction({ kind: allowed('archive') ? 'archive' : 'delete', row, links: linksToRemove(row) });
    }
    const button = (label, onClick, disabled = false, className = 'ui-button ui-button--secondary ui-button--sm') => h('button', { type: 'button', className, disabled: busy || disabled, onClick }, label);
    const tab = (value, label, count) => h('button', { type: 'button', key: value, className: `mapping-tab${status === value ? ' is-active' : ''}`, 'aria-pressed': status === value, disabled: busy, onClick: () => setStatus(value) },
        label, h('span', { className: 'mapping-tab__count' }, count));
    const sectionOptions = unique([details.reference_section, editing?.pdp?.reference_title, ...PLACEHOLDER_SECTIONS]);
    const dialogMessage = !action ? '' : action.kind === 'restore'
        ? `${linkLabel(action.link)}. The link will be active again.`
        : `This removes ${rowLabel(action.row)}. Links affected: ${action.links.map(linkLabel).join('; ')}. ${action.kind === 'delete' ? 'Permanent deletion cannot be undone. Provide a reason.' : 'The objectives and referenced items are kept, and the links can be restored from Archived.'}`;

    const previewTable = showArchived
        ? h('table', { className: 'ui-table' },
            h('thead', null, h('tr', null, ['Type', 'Linked Item', 'DOST Objective', 'Archived', 'Action'].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, archivedLinks.length ? archivedLinks.map(link => h('tr', { key: link.id, className: 'is-archived' },
                h('td', null, link.type === 'pdp-chapter' ? 'PDP Element' : 'Agenda'),
                h('td', null, link.reference_title), h('td', null, link.objective_title),
                h('td', { className: 'mapping-archived-when' }, [link.archived_by_name, link.archived_at && new Date(link.archived_at).toLocaleDateString()].filter(Boolean).join(' · ') || 'Archived'),
                h('td', null, allowed('restore') && canChange(link) && button('Restore', () => setAction({ kind: 'restore', link }), false, 'mapping-action mapping-action--restore'))))
                : h('tr', null, h('td', { colSpan: 5 }, 'No archived mappings.'))))
        : h('table', { className: 'ui-table' },
            h('thead', null, h('tr', null, ['Agenda', 'PDP Element', 'DOST Objective', 'Agency Plan', ...(canRemove ? ['Action'] : [])].map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, visibleRows.length ? visibleRows.map(row => h('tr', { key: row.key, className: row.key === editingKey ? 'is-selected' : '' },
                h('td', null, row.agenda?.reference_title || 'Not linked'),
                h('td', null, row.pdp?.reference_title || 'Not linked'),
                h('td', null, row.objectives.map(item => item.objective_title).join(', ')),
                h('td', null, unique(row.objectives.map(item => item.agency)).join(', ') || 'Not assigned'),
                canRemove && h('td', null, h('button', { type: 'button', className: 'mapping-action mapping-action--delete', disabled: busy, onClick: () => requestRemove(row) },
                    h('i', { className: 'bi bi-trash3-fill', 'aria-hidden': true }), 'Remove'))))
                : h('tr', null, h('td', { colSpan: canRemove ? 5 : 4 }, 'No active mappings.'))));

    return h(React.Fragment, null, h(AppSidebar), h('main', { className: 'app-shell-main mapping-page' }, h('div', { className: 'app-shell-container mapping-container' },
        h(PageHeader, { section: 'Alignment', title: readOnly ? 'Strategic Alignment Overview' : 'Strategic Mapping',
            subtitle: readOnly ? 'See how each plan links Presidential Agenda items and PDP elements to DOST objectives and agency plans. This view is read-only.'
                : 'Map Agenda items and PDP elements to DOST objectives, then link supporting reference sections.' }),
        h('section', { className: 'ui-card mapping-context' }, h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Strategic Plan'), h('select', { className: 'ui-select', value: planId, disabled: busy, onChange: event => { setPlanId(event.target.value); setSelected({ agenda: '', pdp: '', objectives: [] }); setNotice(''); setError(''); setEditingKey(''); setAction(null); setPage(1); } },
            h('option', { value: '', disabled: true }, 'Select a strategic plan'),
            plans.map(plan => h('option', { key: plan.record_id, value: plan.record_id }, plan.title))))),
        // Objectives and Plan Overview are planning-editor steps; Management (which may only delete
        // mappings) reviews the plan in Plan Review instead.
        !readOnly && planId && data && !loading && (can('strategic_records.update') ? h('div', { className: 'mapping-navigation-actions' },
            h('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: `/strategic-plans/${planId}/objectives`, onClick: event => { if (busy) event.preventDefault(); }, 'aria-disabled': busy }, 'Back to Objectives'),
            h('a', { className: 'ui-button ui-button--primary ui-button--sm', href: `/strategic-plans/${planId}/overview`, onClick: event => { if (busy) event.preventDefault(); }, 'aria-disabled': busy }, 'Review Plan'))
            : isManagementSession(getAccessSession()) ? h('div', { className: 'mapping-navigation-actions' },
                h('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: `/management-plan-review?plan=${planId}` }, 'Open in Plan Review')) : null),
        notice && h('p', { className: 'ui-status ui-status--success', role: 'status' }, notice),
        error && h('p', { className: 'ui-status ui-status--error', role: 'alert' }, error),
        loading ? h('section', { className: 'ui-card ui-empty', role: 'status' }, 'Loading alignments…') : !planId ? h('section', { className: 'ui-card ui-empty mapping-empty' }, h('i', { className: 'bi bi-diagram-3', 'aria-hidden': true }), h('p', null, 'No plans are available in your scope.'), h('small', null, readOnly ? 'Plans you are authorised to view will appear here.' : 'Create a strategic plan and its objectives first, then map them here.')) : h(React.Fragment, null,
            !readOnly && data && !Object.values(capabilities).some(Boolean) && h('p', null, 'These alignments are read-only for your permissions or the current plan status.'),
            allowed('create') && h('form', { className: 'ui-card mapping-step mapping-hierarchy-step', onSubmit: add },
                h('div', { className: 'mapping-step__heading' }, h('span', null, '1'), h('h2', null, 'Step 1. Create Three-Level Mapping')),
                h('div', { className: 'mapping-levels' },
                    choiceLevel('Agenda', 'bi-bank2', 'agenda', catalog.presidential_agenda || [], 'agenda_id', 'title', false),
                    h('i', { className: 'bi bi-arrow-right mapping-arrow', 'aria-hidden': true }),
                    choiceLevel('PDP Elements', 'bi-file-earmark-text-fill', 'pdp', catalog.pdp_chapters || [], 'chapter_id', 'chapter_title', false),
                    h('i', { className: 'bi bi-arrow-right mapping-arrow', 'aria-hidden': true }),
                    choiceLevel('DOST Objectives', 'bi-bullseye', 'dost', objectives, 'objective_id', 'objective_title', true,
                        { message: 'This plan has no DOST objectives yet. Add objectives to the plan, then map them here.', href: `/strategic-plans/${planId}/objectives`, label: 'Add objectives' })),
                h('div', { className: 'mapping-hierarchy-action' }, h('button', { className: 'ui-button ui-button--primary mapping-primary', disabled: busy || !ready }, busy ? 'Saving…' : '+ Add Hierarchical Mapping'))),
            h('section', { className: 'ui-card mapping-preview-card' },
                h('div', { className: 'mapping-preview-card__header' }, h('h2', null, 'Three-level Mapping Preview'),
                    canRemove && h('div', { className: 'mapping-tabs', role: 'group', 'aria-label': 'Mapping status' },
                        tab('active', 'Active', hierarchy.length), tab('archived', 'Archived', archivedLinks.length))),
                h('div', { className: 'mapping-preview' }, previewTable),
                !showArchived && h('div', { className: 'mapping-preview-footer' },
                    h('p', { className: 'mapping-count' }, hierarchy.length
                        ? `Showing ${visibleRows.length} of ${hierarchy.length} mapping${hierarchy.length === 1 ? '' : 's'}`
                        : 'Showing 0 of 0 mappings'),
                    pageCount > 1 && h('div', { className: 'mapping-pager' },
                        button('Previous', () => setPage(currentPage - 1), currentPage === 1),
                        h('span', null, `Page ${currentPage} of ${pageCount}`),
                        button('Next', () => setPage(currentPage + 1), currentPage === pageCount)))),
            allowed('reference') && h('section', { className: 'ui-card mapping-reference-step' },
                h('div', { className: 'mapping-step__heading' }, h('span', null, '2'), h('h2', null, 'Step 2. Link the Mapping to Uploaded Reference Sections')),
                h('div', { className: 'mapping-reference-layout' },
                    h('aside', { className: 'mapping-selected-panel' }, h('h3', null, 'Selected Hierarchical Mapping'), h('small', null, 'Choose an existing hierarchical mapping'),
                        h('label', { className: 'mapping-search-select' }, h('span', { className: 'ui-visually-hidden' }, 'Search mapping'),
                            h('i', { className: 'bi bi-search', 'aria-hidden': true }),
                            h('select', { value: editingKey, disabled: busy, onChange: event => event.target.value ? selectMapping(event.target.value) : setEditingKey('') },
                                h('option', { value: '' }, 'Search mapping'),
                                hierarchy.map(row => h('option', { key: row.key, value: row.key }, rowLabel(row))))),
                        h('div', { className: 'mapping-selected-chain' },
                            h('article', { className: 'is-pdp' }, h('i', { className: 'bi bi-file-earmark-text-fill', 'aria-hidden': true }), h('div', null, h('small', null, 'PDP Element'), h('strong', null, editing ? editing.pdp?.reference_title || 'Not linked' : 'Select a mapping'))),
                            h('article', { className: 'is-dost' }, h('i', { className: 'bi bi-bullseye', 'aria-hidden': true }), h('div', null, h('small', null, 'DOST Objective'), h('strong', null, editing ? editing.objectives.map(item => item.objective_title).join(', ') : 'Select a mapping'))),
                            h('article', { className: 'is-agency' }, h('i', { className: 'bi bi-bank2', 'aria-hidden': true }), h('div', null, h('small', null, 'Agency Plan'), h('strong', null, editing ? unique(editing.objectives.map(item => item.agency)).join(', ') || 'Not assigned' : 'Select a mapping'))))),
                    h('form', { onSubmit: saveReference }, h('fieldset', { className: 'mapping-reference-form', disabled: busy || !editing },
                        h('legend', null, 'Reference Section Details'),
                        h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Uploaded Reference File'),
                            h('select', { className: 'ui-select', required: true, value: details.document_id || '', onChange: event => setDetails({ ...details, document_id: event.target.value }) },
                                h('option', { value: '' }, documents.length || !editing ? 'Select uploaded reference file' : 'No uploaded files for this plan yet'),
                                documents.map(document => h('option', { key: document.document_id, value: document.document_id }, document.original_filename)))),
                        h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Reference Chapter / Section'),
                            h('select', { className: 'ui-select', required: true, value: details.reference_section || '', onChange: event => setDetails({ ...details, reference_section: event.target.value }) },
                                h('option', { value: '' }, 'Select chapter or section'),
                                sectionOptions.map(section => h('option', { key: section, value: section }, section))),
                            h('small', { className: 'mapping-field-hint' }, 'Sample sections are shown until chapter lists can be read from uploaded files.')),
                        h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Page / Paragraph ', h('em', null, '(Optional)')), h('input', { className: 'ui-input', placeholder: 'e.g. Page 24, Section 2.1', value: details.page_paragraph || '', onChange: event => setDetails({ ...details, page_paragraph: event.target.value }) })),
                        h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Note ', h('em', null, '(Optional)')), h('textarea', { className: 'ui-textarea', maxLength: 2000, placeholder: 'Add any additional notes about this reference mapping...', value: details.note || '', onChange: event => setDetails({ ...details, note: event.target.value }) })),
                        h('button', { className: 'ui-button ui-button--primary mapping-primary mapping-reference-submit' }, '+ Add Reference Mapping')))))
        ),
        h(AppDialog, { open: Boolean(action), variant: 'danger',
            title: !action ? '' : action.kind === 'restore' ? 'Restore mapping?' : 'Remove mapping?',
            message: dialogMessage,
            confirmLabel: action?.kind === 'restore' ? 'Restore' : 'Remove', confirmDisabled: busy || (action?.kind === 'delete' && !reason.trim()), onConfirm: confirm, onCancel: () => setAction(null) },
            action?.kind === 'delete' && h('label', { className: 'ui-field' }, 'Deletion reason', h('textarea', { className: 'ui-textarea', required: true, maxLength: 1000, value: reason, onChange: event => setReason(event.target.value) })))
    )));
}

mountProtectedPage(document.getElementById('root'), () => h(MappingApp));
