const STORAGE_KEY = 'spdms.frontend-objective-mappings';

export const agendaCatalog = [
    { code: 'PA-08', title: 'Improve R&D capacity' },
    { code: 'PA-10', title: 'Promote Technology Adoption' },
    { code: 'PA-11', title: 'Strengthen collaboration' },
];

function readAll() {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return Array.isArray(stored) ? stored : [];
    } catch { return []; }
}

function writeAll(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function listLocalMappings(planId, office = '') {
    return readAll().filter(item => Number(item.plan_id) === Number(planId) && item.status === 'active' && (!office || item.agency_office === office));
}

export function saveLocalMappings(data, catalog, session) {
    const items = readAll();
    let nextId = items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
    const agencyInput = catalog.agency_inputs.find(item => Number(item.id) === Number(data.agency_input_id)) || null;
    const agencyObjective = catalog.agency_objectives.find(item => Number(item.objective_id) === Number(data.agency_objective_id)) || null;
    let saved = 0;
    data.agenda_codes.forEach(agendaCode => data.pdp_chapter_ids.forEach(pdpId => data.dost_objective_ids.forEach(dostId => {
        const existing = items.find(item => Number(item.plan_id) === Number(data.plan_id) && item.agenda_code === agendaCode && Number(item.pdp_chapter_id) === Number(pdpId) && Number(item.dost_objective_id) === Number(dostId) && Number(item.agency_input_id || 0) === Number(data.agency_input_id || 0) && Number(item.agency_objective_id || 0) === Number(data.agency_objective_id || 0));
        const mapping = {
            ...(existing || {}), id: existing?.id || nextId++, plan_id: Number(data.plan_id), agenda_code: agendaCode,
            agenda_title: agendaCatalog.find(item => item.code === agendaCode)?.title || agendaCode,
            pdp_chapter_id: Number(pdpId), pdp_chapter: catalog.pdp_chapters.find(item => Number(item.chapter_id) === Number(pdpId)) || null,
            dost_objective_id: Number(dostId), dost_objective: catalog.dost_objectives.find(item => Number(item.objective_id) === Number(dostId)) || null,
            agency_input_id: data.agency_input_id || null, agency_input: agencyInput,
            agency_objective_id: data.agency_objective_id || null, agency_objective: agencyObjective,
            agency_office: data.agency_office || null, reference_file: data.reference_file || '', reference_section: data.reference_section || '',
            mapping_rationale: data.mapping_rationale || '', support_reference: data.support_reference || '', page_paragraph: data.page_paragraph || '', note: data.note || '',
            status: 'active', created_by: existing?.created_by || session.userId, updated_by: session.userId, updated_at: new Date().toISOString(),
        };
        if (existing) items[items.indexOf(existing)] = mapping; else items.push(mapping);
        saved++;
    })));
    writeAll(items);
    return saved;
}

export function removeLocalMapping(id) {
    writeAll(readAll().map(item => Number(item.id) === Number(id) ? { ...item, status: 'archived', updated_at: new Date().toISOString() } : item));
}

export function updateLocalMappingReference(id, details, session) {
    const items = readAll();
    const index = items.findIndex(item => Number(item.id) === Number(id) && item.status === 'active');
    if (index < 0) throw new Error('Select an existing hierarchical mapping.');
    items[index] = {
        ...items[index],
        reference_file: details.reference_file || '',
        reference_section: details.reference_section || '',
        page_paragraph: details.page_paragraph || '',
        note: details.note || '',
        updated_by: session.userId,
        updated_at: new Date().toISOString(),
    };
    writeAll(items);
    return items[index];
}
