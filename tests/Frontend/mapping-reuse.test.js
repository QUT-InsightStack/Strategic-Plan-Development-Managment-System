import assert from 'node:assert/strict';
import test from 'node:test';
import { listLocalMappings, listPlannerMappings, saveLocalMappings } from '../../resources/js/mappings/mapping-storage.js';

const values = new Map();
globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
};

const catalog = {
    agendas: [],
    pdp_chapters: [{ chapter_id: 4, chapter_title: 'National Development Priorities' }],
    dost_objectives: [{ objective_id: 9, objective_title: 'Strengthen research capability' }],
    agency_inputs: [{ id: 12, type: 'objective', payload: { objective_title: 'Agency research programme' } }],
    agency_objectives: [],
};

test('office mapping reuses a planner hierarchy and remains scoped to its office', () => {
    values.clear();
    saveLocalMappings({
        plan_id: 3,
        agenda_codes: ['PA-08'],
        pdp_chapter_ids: [4],
        dost_objective_ids: [9],
    }, catalog, { userId: 1 });

    const plannerMapping = listPlannerMappings(3)[0];
    assert.equal(plannerMapping.agency_office, null);

    saveLocalMappings({
        plan_id: 3,
        agenda_codes: [plannerMapping.agenda_code],
        pdp_chapter_ids: [plannerMapping.pdp_chapter_id],
        dost_objective_ids: [plannerMapping.dost_objective_id],
        agency_input_id: 12,
        agency_office: 'Office 1',
        parent_mapping_id: plannerMapping.id,
    }, catalog, { userId: 2 });

    const officeMappings = listLocalMappings(3, 'Office 1');
    assert.equal(listPlannerMappings(3).length, 1);
    assert.equal(officeMappings.length, 1);
    assert.equal(officeMappings[0].parent_mapping_id, plannerMapping.id);
    assert.equal(officeMappings[0].agency_input.payload.objective_title, 'Agency research programme');
    assert.equal(listLocalMappings(3, 'Office 2').length, 0);
});
