import { AppSidebar } from '../../components/AppSidebar.js';
import { apiRequest } from '../../api/api-client.js';
import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { listStrategicObjectives, assignResponsibleUnitToObjectives, listResponsibleUnits } from '../../api/strategic-objectives-api.js';
import { listPdpChapters } from '../../api/pdp-chapters-api.js';
import { createAccessSession, saveAccessSession, can } from '../../access/access-session.js';
import { isOfficeRole } from '../../access/office-navigation.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { agendaCatalog, archiveLocalMapping, deleteLocalMapping, listLocalArchivedMappings, listLocalMappings, restoreLocalMapping, saveLocalMappings, updateLocalMappingReference } from '../../mappings/mapping-storage.js';
import { AppDialog } from '../../components/AppDialog.js';
import { canDeleteMappings, mappingArchiveBlockReason, mappingChangeLockReason, mappingDeleteBlockReason } from '../../mappings/mapping-eligibility.js';
import { listLocalAgencyInputs } from '../../data/office-demo-storage.js';
import { objectivesAssignedToOffice } from '../../objective-assignment-storage.js';

const h = React.createElement;
const { useEffect, useState } = React;
const viewOnly = new URLSearchParams(location.search).get('mode') === 'view';
const blankDetails = { reference_file: '', reference_section: '', mapping_rationale: '', support_reference: '', page_paragraph: '', note: '' };
const errorText = error => [error.message, ...Object.values(error.errors || {}).flat()].filter(Boolean).join(' ');

function ChoiceLevel({ title, icon, items, selected, onToggle, valueKey, labelKey }) {
    return h('section', { className: 'mapping-level' },
        h('h3', null, h('i', { className: `bi ${icon}`, 'aria-hidden': 'true' }), title),
        h('div', { className: 'mapping-options' }, items.length ? items.map(item => {
            const value = String(item[valueKey]);
            return h('label', { className: 'mapping-option', key: value }, h('input', { type: 'checkbox', checked: selected.includes(value), onChange: () => onToggle(value) }), h('span', null, item[labelKey] || `Item ${value}`));
        }) : h('p', { className: 'mapping-empty' }, `No ${title.toLowerCase()} available.`)));
}

const agencyLabel = item => item.agency_objective?.objective_title || item.agency_input?.payload?.objective_title || item.agency_input?.payload?.content || item.dost_objective?.responsible_office_agency || '—';
const mappingChain = item => `${item.agenda_title} → ${item.pdp_chapter?.chapter_title || 'PDP element'} → ${item.dost_objective?.objective_title || 'DOST objective'}`;
const archivedLabel = item => {
    const date = item.archived_at ? new Date(item.archived_at) : null;
    const when = date && !Number.isNaN(date.getTime()) ? date.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    return item.archived_by_name ? `${when} by ${item.archived_by_name}` : when;
};

function MappingPreview({ mappings, archived, showArchived, setShowArchived, officeMode, canArchive, canDelete, lockReason, busy, onArchive, onRestore, onDelete }) {
    const hasActions = canArchive || canDelete;
    const rows = showArchived ? archived : mappings;
    const columns = ['Agenda', 'PDP Element', 'DOST Objective', 'Agency Plan', ...(showArchived ? ['Archived'] : []), ...(hasActions ? ['Action'] : [])];
    const tab = (archivedTab, label, count) => h('button', {
        type: 'button', role: 'tab', 'aria-selected': showArchived === archivedTab, 'aria-controls': 'mapping-preview-table',
        className: `mapping-tab${showArchived === archivedTab ? ' is-active' : ''}`, onClick: () => setShowArchived(archivedTab),
    }, label, h('span', { className: 'mapping-tab__count' }, count));
    return h('section', { className: 'ui-card mapping-preview-card' },
        h('div', { className: 'mapping-preview-card__header' },
            h('h2', null, officeMode ? 'Four-level Mapping Preview' : 'Three-level Mapping Preview'),
            hasActions && h('div', { className: 'mapping-tabs', role: 'tablist', 'aria-label': 'Mapping status' }, tab(false, 'Active', mappings.length), tab(true, 'Archived', archived.length))),
        hasActions && lockReason && h('p', { className: 'mapping-lock-note', role: 'note' }, h('i', { className: 'bi bi-lock-fill', 'aria-hidden': 'true' }), `${lockReason} Archive, restore and delete are unavailable.`),
        showArchived && h('p', { className: 'mapping-archive-note' }, h('i', { className: 'bi bi-info-circle', 'aria-hidden': 'true' }), 'Archived mappings are kept for reference and are not used in alignment views, reference linking or reports. Restore a mapping to make it active again.'),
        h('div', { className: 'mapping-preview', id: 'mapping-preview-table' }, h('table', { className: 'ui-table' },
            h('thead', null, h('tr', null, columns.map(label => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, rows.length ? rows.map(item => h('tr', { key: item.id, className: showArchived ? 'is-archived' : undefined },
                h('td', null, item.agenda_title), h('td', null, item.pdp_chapter?.chapter_title || '—'), h('td', null, item.dost_objective?.objective_title || '—'),
                h('td', null, agencyLabel(item)),
                showArchived && h('td', { className: 'mapping-archived-when' }, archivedLabel(item)),
                hasActions && h('td', null, h('div', { className: 'mapping-actions' },
                    canArchive && (showArchived
                        ? h('button', { className: 'mapping-action mapping-action--restore', type: 'button', disabled: busy || Boolean(lockReason), title: lockReason || undefined, onClick: () => onRestore(item), 'aria-label': `Restore mapping ${mappingChain(item)}` }, h('i', { className: 'bi bi-arrow-counterclockwise', 'aria-hidden': 'true' }), 'Restore')
                        : h('button', { className: 'mapping-action mapping-action--archive', type: 'button', disabled: busy || Boolean(lockReason), title: lockReason || undefined, onClick: () => onArchive(item), 'aria-label': `Archive mapping ${mappingChain(item)}` }, h('i', { className: 'bi bi-archive', 'aria-hidden': 'true' }), 'Archive')),
                    canDelete && !showArchived && h('button', { className: 'mapping-action mapping-action--delete', type: 'button', disabled: busy || Boolean(lockReason), title: lockReason || undefined, onClick: () => onDelete(item), 'aria-label': `Delete mapping ${mappingChain(item)}` }, h('i', { className: 'bi bi-trash', 'aria-hidden': 'true' }), 'Delete')))
            )) : h('tr', null, h('td', { className: 'mapping-empty', colSpan: columns.length }, showArchived ? 'No archived mappings for this plan.' : 'No hierarchical mappings added yet.'))))),
        h('p', { className: 'mapping-count' }, `Showing ${rows.length} ${showArchived ? 'archived ' : ''}mapping${rows.length === 1 ? '' : 's'}`));
}

function PlannerReferenceStep({ mappings, selectedId, selectMapping, details, setDetails, busy, saveReference }) {
    const selected = mappings.find(item => String(item.id) === String(selectedId));
    const update = (name, value) => setDetails(current => ({ ...current, [name]: value }));
    const mappingOptions = mappings.map((item, index) => h('option', { value: item.id, key: item.id }, `Mapping ${index + 1}: ${item.agenda_title} → ${item.pdp_chapter?.chapter_title || 'PDP'} → ${item.dost_objective?.objective_title || 'DOST'}`));
    const chain = selected ? h('div', { className: 'mapping-selected-chain' },
        h('article', { className: 'is-agenda' }, h('i', { className: 'bi bi-bank2' }), h('div', null, h('small', null, 'Agenda'), h('strong', null, selected.agenda_title))),
        h('article', { className: 'is-pdp' }, h('i', { className: 'bi bi-file-earmark-text-fill' }), h('div', null, h('small', null, 'PDP Element'), h('strong', null, selected.pdp_chapter?.chapter_title || '—'))),
        h('article', { className: 'is-dost' }, h('i', { className: 'bi bi-bullseye' }), h('div', null, h('small', null, 'DOST Objective'), h('strong', null, selected.dost_objective?.objective_title || '—'))),
        h('article', { className: 'is-agency' }, h('i', { className: 'bi bi-building' }), h('div', null, h('small', null, 'Agency Plan'), h('strong', null, selected.dost_objective?.responsible_office_agency || 'Not assigned')))
    ) : null;
    const selectedPanel = h('div', { className: 'mapping-selected-panel' },
        h('h3', null, 'Selected Hierarchical Mapping'),
        h('small', null, 'Choose an existing hierarchical mapping'),
        h('label', { className: 'mapping-search-select' }, h('i', { className: 'bi bi-search' }), h('select', { value: selectedId, onChange: event => selectMapping(event.target.value) }, h('option', { value: '' }, 'Search mapping'), mappingOptions)),
        chain
    );
    const referenceForm = h('form', { className: 'mapping-reference-form', onSubmit: saveReference },
        h('h3', null, 'Reference Section Details'),
        h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Uploaded Reference File'), h('select', { className: 'ui-select', required: true, value: details.reference_file, onChange: event => update('reference_file', event.target.value) }, h('option', { value: '' }, 'Select uploaded reference file'), ['DOST Strategic Plan 2024.pdf', 'Philippine Development Plan.pdf', 'Agency Planning Inputs.pdf'].map(file => h('option', { value: file, key: file }, file)))),
        h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Reference Chapter / Section'), h('select', { className: 'ui-select', required: true, value: details.reference_section, onChange: event => update('reference_section', event.target.value) }, h('option', { value: '' }, 'Select chapter or section'), selected && h('option', { value: selected.pdp_chapter?.chapter_title || 'Mapped PDP Element' }, selected.pdp_chapter?.chapter_title || 'Mapped PDP Element'), h('option', { value: 'Chapter 2: National Development Priorities' }, 'Chapter 2: National Development Priorities'), h('option', { value: 'Strategic Objectives' }, 'Strategic Objectives'))),
        h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Page / Paragraph (Optional)'), h('input', { className: 'ui-input', value: details.page_paragraph, placeholder: 'e.g. Page 24, Section 2.1', onChange: event => update('page_paragraph', event.target.value) })),
        h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Note (Optional)'), h('textarea', { className: 'ui-textarea', rows: 4, value: details.note, placeholder: 'Add any additional notes about this reference mapping...', onChange: event => update('note', event.target.value) })),
        h('button', { className: 'ui-button ui-button--primary mapping-reference-submit', type: 'submit', disabled: busy || !selected }, busy ? 'Saving…' : '+ Add Reference Mapping')
    );
    return h('section', { className: 'ui-card mapping-reference-step' },
        h('div', { className: 'mapping-step__heading' }, h('span', null, '2'), h('h2', null, 'Step 2. Link the Mapping to Uploaded Reference Sections')),
        h('div', { className: 'mapping-reference-layout' }, selectedPanel, referenceForm)
    );
}

function MappingApp({ session }) {
    const officeMode = isOfficeRole(session.roleName);
    const canManage = can('relations.manage', session) && !officeMode;
    const canCreate = !viewOnly && (canManage || can('relations.create', session));
    const [plans, setPlans] = useState([]), [planId, setPlanId] = useState('');
    const [catalog, setCatalog] = useState({ agendas: [], pdp_chapters: [], dost_objectives: [], agency_inputs: [], agency_objectives: [], agencies: [] });
    const [mappings, setMappings] = useState([]), [selected, setSelected] = useState({ agendas: [], pdp: [], dost: [] });
    const [archivedMappings, setArchivedMappings] = useState([]), [showArchived, setShowArchived] = useState(false), [archiveTarget, setArchiveTarget] = useState(null);
    const canArchive = canManage && !viewOnly;
    const canDelete = !viewOnly && !officeMode && canDeleteMappings(session);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [agencyItem, setAgencyItem] = useState(''), [details, setDetails] = useState(blankDetails), [selectedMappingId, setSelectedMappingId] = useState('');
    const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => { listStrategicPlans({ per_page: 100 }).then(result => { const available = (result.data || []).filter(plan => !['archived', 'deleted'].includes(plan.status)); setPlans(available); if (available.length) setPlanId(String(available[0].record_id)); else setLoading(false); }).catch(error => { setMessage({ type: 'error', text: errorText(error) }); setLoading(false); }); }, []);
    useEffect(() => {
        if (!planId) return;
        let active = true; setLoading(true); setMessage({ type: '', text: '' });
        Promise.all([listPdpChapters(), listStrategicObjectives(planId), listResponsibleUnits({ per_page: 100 }), Promise.resolve(officeMode ? listLocalAgencyInputs({ plan_id: planId, created_by: session.userId, per_page: 100 }) : { data: [] })]).then(([pdpResult, objectiveResult, unitsResult, inputResult]) => {
            if (!active) return;
            const objectives = (objectiveResult.data || []).filter(item => !['archived', 'deleted'].includes(item.status));
            setCatalog({ agendas: agendaCatalog, pdp_chapters: pdpResult.data || [], dost_objectives: objectives, agencies: unitsResult.data || [], agency_inputs: inputResult.data || [], agency_objectives: officeMode ? objectivesAssignedToOffice(objectives, session.office) : [] });
            setMappings(listLocalMappings(planId, officeMode ? session.office : '')); setArchivedMappings(canManage || canDelete ? listLocalArchivedMappings(planId) : []); setShowArchived(false); setSelected({ agendas: [], pdp: [], dost: [] }); setAgencyItem(''); setSelectedMappingId(''); setDetails(blankDetails);
        }).catch(error => { if (active) setMessage({ type: 'error', text: errorText(error) }); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [planId]);

    const toggle = (group, value) => setSelected(current => ({ ...current, [group]: current[group].includes(value) ? current[group].filter(item => item !== value) : [...current[group], value] }));
    const selectedPlan = plans.find(plan => String(plan.record_id) === planId);
    const agencyOptions = [...(catalog.agency_objectives || []).map(item => ({ value: `objective:${item.objective_id}`, label: `Assigned objective · ${item.objective_title}` })), ...(catalog.agency_inputs || []).map(item => ({ value: `input:${item.id}`, label: `Submitted ${item.type.replace('_', ' ')} · ${item.payload.objective_title || item.payload.content}` }))];
    const agencyChoices = (catalog.agencies || []).map(unit => ({ value: String(unit.responsible_unit_id), label: unit.responsible_office_agency || unit.name }));
    const refreshMappings = () => { setMappings(listLocalMappings(planId, officeMode ? session.office : '')); setArchivedMappings(canManage || canDelete ? listLocalArchivedMappings(planId) : []); };

    async function addHierarchy(event) {
        event.preventDefault(); if (!canCreate || busy) return;
        if (!selected.agendas.length || !selected.pdp.length || !selected.dost.length || !agencyItem) { setMessage({ type: 'error', text: 'Select an Agenda, PDP Chapter, DOST Objective, and Agency.' }); return; }
        const [agencyType, agencyId] = agencyItem.split(':'); setBusy(true);
        try {
            if (!officeMode) {
                await assignResponsibleUnitToObjectives(selected.dost.map(Number), Number(agencyItem));
            }
            const agencyName = officeMode ? session.office : agencyChoices.find(item => item.value === agencyItem)?.label;
            const count = saveLocalMappings({ plan_id: Number(planId), agenda_codes: selected.agendas, pdp_chapter_ids: selected.pdp.map(Number), dost_objective_ids: selected.dost.map(Number), agency_input_id: officeMode && agencyType === 'input' ? Number(agencyId) : null, agency_objective_id: officeMode && agencyType === 'objective' ? Number(agencyId) : null, agency_office: agencyName, ...blankDetails }, catalog, session);
            refreshMappings(); setSelected({ agendas: [], pdp: [], dost: [] }); setAgencyItem(''); setMessage({ type: 'success', text: `${count} hierarchical mapping${count === 1 ? '' : 's'} added.` });
        }
        catch (error) { setMessage({ type: 'error', text: errorText(error) }); } finally { setBusy(false); }
    }

    async function addReference(event) {
        event.preventDefault(); if (!selectedMappingId || busy) return; setBusy(true);
        try { updateLocalMappingReference(selectedMappingId, details, session); refreshMappings(); setMessage({ type: 'success', text: 'Reference section linked to the selected mapping.' }); }
        catch (error) { setMessage({ type: 'error', text: errorText(error) }); } finally { setBusy(false); }
    }

    function selectReferenceMapping(id) { setSelectedMappingId(id); const item = mappings.find(mapping => String(mapping.id) === String(id)); setDetails(item ? { ...blankDetails, reference_file: item.reference_file || '', reference_section: item.reference_section || '', page_paragraph: item.page_paragraph || '', note: item.note || '' } : blankDetails); }
    function requestArchive(item) {
        if (!canArchive || busy) return;
        const blocked = mappingArchiveBlockReason(item, selectedPlan);
        if (blocked) { setMessage({ type: 'error', text: `This mapping cannot be archived. ${blocked}` }); return; }
        setArchiveTarget(item);
    }
    function confirmArchive() {
        const item = archiveTarget; setArchiveTarget(null); if (!item) return;
        // Re-checked at confirmation: the plan may have been locked, or the
        // mapping archived in another tab, while the dialog was open.
        const current = listLocalMappings(planId, officeMode ? session.office : '').find(mapping => String(mapping.id) === String(item.id))
            || listLocalArchivedMappings(planId).find(mapping => String(mapping.id) === String(item.id));
        const blocked = mappingArchiveBlockReason(current, selectedPlan);
        if (blocked) { setMessage({ type: 'error', text: `This mapping cannot be archived. ${blocked}` }); refreshMappings(); return; }
        setBusy(true);
        try { archiveLocalMapping(item.id, session); refreshMappings(); if (String(item.id) === String(selectedMappingId)) selectReferenceMapping(''); setMessage({ type: 'success', text: 'Mapping archived. It is no longer an active alignment; its Strategic Objective, PDP Chapter and Presidential Agenda item are unchanged. You can find it under Archived.' }); }
        catch (error) { setMessage({ type: 'error', text: errorText(error) }); refreshMappings(); } finally { setBusy(false); }
    }
    function requestDelete(item) {
        if (!canDelete || busy) return;
        const blocked = mappingDeleteBlockReason(item, selectedPlan);
        if (blocked) { setMessage({ type: 'error', text: `This mapping cannot be deleted. ${blocked}` }); return; }
        setDeleteTarget(item);
    }
    function confirmDelete() {
        const item = deleteTarget; setDeleteTarget(null); if (!item) return;
        // Re-checked at confirmation in case the mapping was archived or
        // deleted, or the plan locked, while the dialog was open.
        const current = listLocalMappings(planId, officeMode ? session.office : '').find(mapping => String(mapping.id) === String(item.id))
            || listLocalArchivedMappings(planId).find(mapping => String(mapping.id) === String(item.id));
        const blocked = mappingDeleteBlockReason(current, selectedPlan);
        if (blocked) { setMessage({ type: 'error', text: `This mapping cannot be deleted. ${blocked}` }); refreshMappings(); return; }
        setBusy(true);
        try { deleteLocalMapping(item.id, session); refreshMappings(); if (String(item.id) === String(selectedMappingId)) selectReferenceMapping(''); setMessage({ type: 'success', text: `Mapping “${mappingChain(item)}” was deleted permanently. Other mappings and the related objective, PDP chapter and agenda item are unchanged.` }); }
        catch (error) { setMessage({ type: 'error', text: errorText(error) }); refreshMappings(); } finally { setBusy(false); }
    }
    function restore(item) {
        if (!canArchive || busy) return;
        const blocked = mappingChangeLockReason(selectedPlan);
        if (blocked) { setMessage({ type: 'error', text: `This mapping cannot be restored. ${blocked}` }); return; }
        setBusy(true);
        try { restoreLocalMapping(item.id, session); refreshMappings(); setMessage({ type: 'success', text: 'Mapping restored and active again.' }); }
        catch (error) { setMessage({ type: 'error', text: errorText(error) }); refreshMappings(); } finally { setBusy(false); }
    }

    const agencySelector = officeMode
        ? h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Agency Input / Objective'),
            h('select', { className: 'ui-select', value: agencyItem, disabled: viewOnly, onChange: event => setAgencyItem(event.target.value) },
                h('option', { value: '' }, 'Select an item assigned to your office'),
                agencyOptions.map(item => h('option', { value: item.value, key: item.value }, item.label))))
        : canCreate && h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Agency'),
            h('select', { className: 'ui-select', value: agencyItem, disabled: viewOnly || !selected.dost.length, onChange: event => setAgencyItem(event.target.value) },
                h('option', { value: '' }, selected.dost.length ? 'Select the Agency assigned to this DOST objective' : 'Select DOST objectives first'),
                agencyChoices.map(item => h('option', { value: item.value, key: item.value }, item.label))));

    return h(React.Fragment, null, h(AppSidebar, { active: 'Mapping Module', onNotice: text => setMessage({ type: 'info', text }) }), h('main', { className: 'app-shell-main mapping-page' }, h('div', { className: 'app-shell-container mapping-container' },
        h('header', { className: 'mapping-header' }, h('h1', null, officeMode ? 'View/Add Mapping' : 'Create Reference Mapping'), h('p', null, officeMode ? 'View the hierarchy and submit your Agency input.' : 'Map Presidential Agenda → PDP Chapter → DOST Objective → Agency in one workflow, then link reference sections.')),
        message.text && h('div', { className: `ui-status ui-status--${message.type}`, role: message.type === 'error' ? 'alert' : 'status' }, message.text),
        h('section', { className: 'ui-card mapping-context' },
            h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Strategic Plan'),
                h('select', { className: 'ui-select', value: planId, onChange: event => setPlanId(event.target.value) },
                    plans.map(plan => h('option', { value: plan.record_id, key: plan.record_id }, plan.title))),
            ),
            agencySelector,
        ),
        loading ? h('section', { className: 'ui-card mapping-empty' }, 'Loading mapping data…') : h(React.Fragment, null,
            canCreate && h('form', { className: 'ui-card mapping-step mapping-hierarchy-step', onSubmit: addHierarchy }, h('div', { className: 'mapping-step__heading' }, h('span', null, '1'), h('h2', null, officeMode ? 'Step 1. Map Agency Input Across Levels' : 'Step 1. Create Three-Level Mapping')), h('div', { className: 'mapping-levels' }, h(ChoiceLevel, { title: 'Agenda', icon: 'bi-bank2', items: catalog.agendas, selected: selected.agendas, onToggle: value => toggle('agendas', value), valueKey: 'code', labelKey: 'title' }), h('i', { className: 'bi bi-arrow-right mapping-arrow' }), h(ChoiceLevel, { title: 'PDP Elements', icon: 'bi-file-earmark-text-fill', items: catalog.pdp_chapters, selected: selected.pdp, onToggle: value => toggle('pdp', value), valueKey: 'chapter_id', labelKey: 'chapter_title' }), h('i', { className: 'bi bi-arrow-right mapping-arrow' }), h(ChoiceLevel, { title: 'DOST Objectives', icon: 'bi-bullseye', items: catalog.dost_objectives, selected: selected.dost, onToggle: value => toggle('dost', value), valueKey: 'objective_id', labelKey: 'objective_title' })), h('div', { className: 'mapping-hierarchy-action' }, h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'submit', disabled: busy || selectedPlan?.status !== 'draft' }, busy ? 'Adding…' : '+ Add Hierarchical Mapping'))),
            h(MappingPreview, { mappings, archived: archivedMappings, showArchived: (canArchive || canDelete) && showArchived, setShowArchived, officeMode, canArchive, canDelete, lockReason: (canArchive || canDelete) ? mappingChangeLockReason(selectedPlan) : null, busy, onArchive: requestArchive, onRestore: restore, onDelete: requestDelete }),
            !officeMode && canManage && h(PlannerReferenceStep, { mappings, selectedId: selectedMappingId, selectMapping: selectReferenceMapping, details, setDetails, busy, saveReference: addReference })
        ),
        h(AppDialog, { open: Boolean(archiveTarget), variant: 'danger', title: 'Archive this mapping?', message: archiveTarget ? `“${mappingChain(archiveTarget)}” will be removed from active alignment and reference linking. It stays stored and can be restored at any time.` : '', confirmLabel: 'Archive mapping', cancelLabel: 'Cancel', onConfirm: confirmArchive, onCancel: () => setArchiveTarget(null) }),
        h(AppDialog, { open: Boolean(deleteTarget), variant: 'danger', title: 'Delete this mapping permanently?', message: deleteTarget ? `“${mappingChain(deleteTarget)}” and its linked reference details will be permanently deleted. This cannot be undone. The Strategic Objective, PDP Chapter and Presidential Agenda item are not affected.${canArchive ? ' To keep a record instead, archive it.' : ''}` : '', confirmLabel: 'Delete permanently', cancelLabel: 'Cancel', onConfirm: confirmDelete, onCancel: () => setDeleteTarget(null) })
    )));
}

const appRoot = ReactDOM.createRoot(document.getElementById('root'));
appRoot.render(h('p', { role: 'status' }, 'Loading mapping access…'));
apiRequest('/api/auth/me').then(payload => { const session = saveAccessSession(createAccessSession(payload.data)); if (enforcePageAccess()) appRoot.render(h(MappingApp, { session })); }).catch(error => appRoot.render(h('p', { role: 'alert' }, error.message)));
