import { AppSidebar } from '../components/AppSidebar.js';
import { apiRequest } from '../api/api-client.js';
import { listStrategicPlans } from '../api/strategic-plans-api.js';
import { listStrategicObjectives } from '../api/strategic-objectives-api.js';
import { listPdpChapters } from '../api/pdp-chapters-api.js';
import { createAccessSession, saveAccessSession, can } from '../access/access-session.js';
import { isOfficeRole } from '../access/office-navigation.js';
import { enforcePageAccess } from '../access/access-guard.js';
import { agendaCatalog, listLocalMappings, removeLocalMapping, saveLocalMappings, updateLocalMappingReference } from '../mappings/mapping-storage.js';
import { listLocalAgencyInputs } from '../office-demo-storage.js';
import { applyLocalObjectiveAssignments, objectivesAssignedToOffice } from '../objective-assignment-storage.js';

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

function MappingPreview({ mappings, officeMode, canRemove, busy, remove }) {
    return h('section', { className: 'ui-card mapping-preview-card' },
        h('h2', null, officeMode ? 'Four-level Mapping Preview' : 'Three-level Mapping Preview'),
        h('div', { className: 'mapping-preview' }, h('table', { className: 'ui-table' },
            h('thead', null, h('tr', null, ['Agenda', 'PDP Element', 'DOST Objective', 'Agency Plan', ...(canRemove ? ['Action'] : [])].map(label => h('th', { key: label }, label)))),
            h('tbody', null, mappings.length ? mappings.map(item => h('tr', { key: item.id },
                h('td', null, item.agenda_title), h('td', null, item.pdp_chapter?.chapter_title || '—'), h('td', null, item.dost_objective?.objective_title || '—'),
                h('td', null, item.agency_objective?.objective_title || item.agency_input?.payload?.objective_title || item.agency_input?.payload?.content || item.dost_objective?.responsible_office_agency || '—'),
                canRemove && h('td', null, h('button', { className: 'mapping-remove', type: 'button', disabled: busy, onClick: () => remove(item.id) }, h('i', { className: 'bi bi-trash-fill' }), 'Remove'))
            )) : h('tr', null, h('td', { className: 'mapping-empty', colSpan: canRemove ? 5 : 4 }, 'No hierarchical mappings added yet.'))))),
        h('p', { className: 'mapping-count' }, `Showing ${mappings.length} mapping${mappings.length === 1 ? '' : 's'}`));
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
    const [catalog, setCatalog] = useState({ agendas: [], pdp_chapters: [], dost_objectives: [], agency_inputs: [], agency_objectives: [] });
    const [mappings, setMappings] = useState([]), [selected, setSelected] = useState({ agendas: [], pdp: [], dost: [] });
    const [agencyItem, setAgencyItem] = useState(''), [details, setDetails] = useState(blankDetails), [selectedMappingId, setSelectedMappingId] = useState('');
    const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => { listStrategicPlans({ per_page: 100 }).then(result => { const available = (result.data || []).filter(plan => !['archived', 'deleted'].includes(plan.status)); setPlans(available); if (available.length) setPlanId(String(available[0].record_id)); else setLoading(false); }).catch(error => { setMessage({ type: 'error', text: errorText(error) }); setLoading(false); }); }, []);
    useEffect(() => {
        if (!planId) return;
        let active = true; setLoading(true); setMessage({ type: '', text: '' });
        Promise.all([listPdpChapters(), listStrategicObjectives(planId), Promise.resolve(officeMode ? listLocalAgencyInputs({ plan_id: planId, created_by: session.userId, per_page: 100 }) : { data: [] })]).then(([pdpResult, objectiveResult, inputResult]) => {
            if (!active) return;
            const objectives = applyLocalObjectiveAssignments(objectiveResult.data || []).filter(item => !['archived', 'deleted'].includes(item.status));
            setCatalog({ agendas: agendaCatalog, pdp_chapters: pdpResult.data || [], dost_objectives: objectives, agency_inputs: inputResult.data || [], agency_objectives: officeMode ? objectivesAssignedToOffice(objectives, session.office) : [] });
            setMappings(listLocalMappings(planId, officeMode ? session.office : '')); setSelected({ agendas: [], pdp: [], dost: [] }); setAgencyItem(''); setSelectedMappingId(''); setDetails(blankDetails);
        }).catch(error => { if (active) setMessage({ type: 'error', text: errorText(error) }); }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [planId]);

    const toggle = (group, value) => setSelected(current => ({ ...current, [group]: current[group].includes(value) ? current[group].filter(item => item !== value) : [...current[group], value] }));
    const selectedPlan = plans.find(plan => String(plan.record_id) === planId);
    const agencyOptions = [...(catalog.agency_objectives || []).map(item => ({ value: `objective:${item.objective_id}`, label: `Assigned objective · ${item.objective_title}` })), ...(catalog.agency_inputs || []).map(item => ({ value: `input:${item.id}`, label: `Submitted ${item.type.replace('_', ' ')} · ${item.payload.objective_title || item.payload.content}` }))];
    const refreshMappings = () => setMappings(listLocalMappings(planId, officeMode ? session.office : ''));

    async function addHierarchy(event) {
        event.preventDefault(); if (!canCreate || busy) return;
        if (!selected.agendas.length || !selected.pdp.length || !selected.dost.length || (officeMode && !agencyItem)) { setMessage({ type: 'error', text: `Select at least one Agenda, PDP Element, DOST Objective${officeMode ? ', and Agency item' : ''}.` }); return; }
        const [agencyType, agencyId] = agencyItem.split(':'); setBusy(true);
        try { const count = saveLocalMappings({ plan_id: Number(planId), agenda_codes: selected.agendas, pdp_chapter_ids: selected.pdp.map(Number), dost_objective_ids: selected.dost.map(Number), agency_input_id: agencyType === 'input' ? Number(agencyId) : null, agency_objective_id: agencyType === 'objective' ? Number(agencyId) : null, agency_office: officeMode ? session.office : null, ...blankDetails }, catalog, session); refreshMappings(); setSelected({ agendas: [], pdp: [], dost: [] }); setAgencyItem(''); setMessage({ type: 'success', text: `${count} hierarchical mapping${count === 1 ? '' : 's'} added.` }); }
        catch (error) { setMessage({ type: 'error', text: errorText(error) }); } finally { setBusy(false); }
    }

    async function addReference(event) {
        event.preventDefault(); if (!selectedMappingId || busy) return; setBusy(true);
        try { updateLocalMappingReference(selectedMappingId, details, session); refreshMappings(); setMessage({ type: 'success', text: 'Reference section linked to the selected mapping.' }); }
        catch (error) { setMessage({ type: 'error', text: errorText(error) }); } finally { setBusy(false); }
    }

    function selectReferenceMapping(id) { setSelectedMappingId(id); const item = mappings.find(mapping => String(mapping.id) === String(id)); setDetails(item ? { ...blankDetails, reference_file: item.reference_file || '', reference_section: item.reference_section || '', page_paragraph: item.page_paragraph || '', note: item.note || '' } : blankDetails); }
    async function remove(id) { setBusy(true); try { removeLocalMapping(id); refreshMappings(); if (String(id) === String(selectedMappingId)) selectReferenceMapping(''); setMessage({ type: 'success', text: 'Mapping removed.' }); } catch (error) { setMessage({ type: 'error', text: errorText(error) }); } finally { setBusy(false); } }

    return h(React.Fragment, null, h(AppSidebar, { active: 'Mapping Module', onNotice: text => setMessage({ type: 'info', text }) }), h('main', { className: 'app-shell-main mapping-page' }, h('div', { className: 'app-shell-container mapping-container' },
        h('header', { className: 'mapping-header' }, h('h1', null, officeMode ? 'View/Add Mapping' : 'Create Reference Mapping'), h('p', null, officeMode ? 'Map your Agency inputs across Presidential Agenda, PDP, and DOST levels.' : 'Create three-level mappings across Presidential Agenda, PDP, and DOST objectives, then link them to uploaded reference sections.')),
        message.text && h('div', { className: `ui-status ui-status--${message.type}`, role: message.type === 'error' ? 'alert' : 'status' }, message.text),
        h('section', { className: 'ui-card mapping-context' }, h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Strategic Plan'), h('select', { className: 'ui-select', value: planId, onChange: event => setPlanId(event.target.value) }, plans.map(plan => h('option', { value: plan.record_id, key: plan.record_id }, plan.title)))), officeMode && h('label', { className: 'ui-field' }, h('span', { className: 'ui-label' }, 'Agency Input / Objective'), h('select', { className: 'ui-select', value: agencyItem, disabled: viewOnly, onChange: event => setAgencyItem(event.target.value) }, h('option', { value: '' }, 'Select an item assigned to your office'), agencyOptions.map(item => h('option', { value: item.value, key: item.value }, item.label))))),
        loading ? h('section', { className: 'ui-card mapping-empty' }, 'Loading mapping data…') : h(React.Fragment, null,
            canCreate && h('form', { className: 'ui-card mapping-step mapping-hierarchy-step', onSubmit: addHierarchy }, h('div', { className: 'mapping-step__heading' }, h('span', null, '1'), h('h2', null, officeMode ? 'Step 1. Map Agency Input Across Levels' : 'Step 1. Create Three-Level Mapping')), h('div', { className: 'mapping-levels' }, h(ChoiceLevel, { title: 'Agenda', icon: 'bi-bank2', items: catalog.agendas, selected: selected.agendas, onToggle: value => toggle('agendas', value), valueKey: 'code', labelKey: 'title' }), h('i', { className: 'bi bi-arrow-right mapping-arrow' }), h(ChoiceLevel, { title: 'PDP Elements', icon: 'bi-file-earmark-text-fill', items: catalog.pdp_chapters, selected: selected.pdp, onToggle: value => toggle('pdp', value), valueKey: 'chapter_id', labelKey: 'chapter_title' }), h('i', { className: 'bi bi-arrow-right mapping-arrow' }), h(ChoiceLevel, { title: 'DOST Objectives', icon: 'bi-bullseye', items: catalog.dost_objectives, selected: selected.dost, onToggle: value => toggle('dost', value), valueKey: 'objective_id', labelKey: 'objective_title' })), h('div', { className: 'mapping-hierarchy-action' }, h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'submit', disabled: busy || selectedPlan?.status !== 'draft' }, busy ? 'Adding…' : '+ Add Hierarchical Mapping'))),
            h(MappingPreview, { mappings, officeMode, canRemove: canManage && selectedPlan?.status === 'draft', busy, remove }),
            !officeMode && canManage && h(PlannerReferenceStep, { mappings, selectedId: selectedMappingId, selectMapping: selectReferenceMapping, details, setDetails, busy, saveReference: addReference })
        )
    )));
}

const appRoot = ReactDOM.createRoot(document.getElementById('root'));
appRoot.render(h('p', { role: 'status' }, 'Loading mapping access…'));
apiRequest('/api/auth/me').then(payload => { const session = saveAccessSession(createAccessSession(payload.data)); if (enforcePageAccess()) appRoot.render(h(MappingApp, { session })); }).catch(error => appRoot.render(h('p', { role: 'alert' }, error.message)));
