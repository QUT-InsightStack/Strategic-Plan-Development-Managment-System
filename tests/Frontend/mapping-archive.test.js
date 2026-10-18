import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
};

const {
    archiveLocalMapping,
    listLocalArchivedMappings,
    listLocalMappings,
    restoreLocalMapping,
    saveLocalMappings,
} = await import('../../resources/js/mappings/mapping-storage.js');

const catalog = {
    agency_inputs: [],
    agency_objectives: [],
    pdp_chapters: [{ chapter_id: 3, chapter_title: 'Chapter 3' }],
    dost_objectives: [{ objective_id: 10, objective_title: 'Grow R&D' }, { objective_id: 11, objective_title: 'Adopt tech' }],
};
const session = { userId: 7, name: 'Gurleen Arneja' };

beforeEach(() => {
    store.clear();
    saveLocalMappings({ plan_id: 1, agenda_codes: ['PA-08'], pdp_chapter_ids: [3], dost_objective_ids: [10, 11] }, catalog, session);
});

test('archiving hides a mapping from active lists and records who archived it', () => {
    const [first] = listLocalMappings(1);
    const archived = archiveLocalMapping(first.id, session);

    assert.equal(archived.status, 'archived');
    assert.equal(archived.archived_by, 7);
    assert.equal(archived.archived_by_name, 'Gurleen Arneja');
    assert.ok(archived.archived_at);
    assert.equal(listLocalMappings(1).length, 1);
    assert.deepEqual(listLocalArchivedMappings(1).map((item) => item.id), [first.id]);
});

test('archiving keeps the mapping details so it can be restored intact', () => {
    const [first] = listLocalMappings(1);
    archiveLocalMapping(first.id, session);
    const restored = restoreLocalMapping(first.id, session);

    assert.equal(restored.status, 'active');
    assert.equal(restored.archived_at, null);
    assert.equal(restored.dost_objective.objective_title, first.dost_objective.objective_title);
    assert.equal(listLocalMappings(1).length, 2);
    assert.equal(listLocalArchivedMappings(1).length, 0);
});

test('archive and restore refuse invalid transitions', () => {
    const [first] = listLocalMappings(1);
    assert.throws(() => restoreLocalMapping(first.id, session), /Only archived/);
    archiveLocalMapping(first.id, session);
    assert.throws(() => archiveLocalMapping(first.id, session), /already archived/);
    assert.throws(() => archiveLocalMapping(999, session), /no longer exists/);
});

test('re-adding an archived chain makes it active again without duplicating it', () => {
    const [first] = listLocalMappings(1);
    archiveLocalMapping(first.id, session);
    saveLocalMappings({ plan_id: 1, agenda_codes: ['PA-08'], pdp_chapter_ids: [3], dost_objective_ids: [first.dost_objective_id] }, catalog, session);

    assert.equal(listLocalMappings(1).length, 2);
    assert.equal(listLocalArchivedMappings(1).length, 0);
    assert.equal(listLocalMappings(1).find((item) => item.id === first.id).archived_at, null);
});

test('archived mappings are listed per plan and per office', () => {
    saveLocalMappings({ plan_id: 2, agenda_codes: ['PA-10'], pdp_chapter_ids: [3], dost_objective_ids: [10], agency_office: 'Office 1' }, catalog, session);
    const [other] = listLocalMappings(2);
    archiveLocalMapping(other.id, session);

    assert.equal(listLocalArchivedMappings(1).length, 0);
    assert.equal(listLocalArchivedMappings(2, 'Office 1').length, 1);
    assert.equal(listLocalArchivedMappings(2, 'Office 2').length, 0);
});
