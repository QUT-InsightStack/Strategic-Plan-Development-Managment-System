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
    deleteLocalMapping,
    listLocalArchivedMappings,
    listLocalMappings,
    saveLocalMappings,
} = await import('../../resources/js/mappings/mapping-storage.js');

const catalog = {
    agency_inputs: [],
    agency_objectives: [],
    pdp_chapters: [{ chapter_id: 3, chapter_title: 'Chapter 3' }],
    dost_objectives: [{ objective_id: 10, objective_title: 'Grow R&D' }, { objective_id: 11, objective_title: 'Adopt tech' }],
};

beforeEach(() => {
    store.clear();
    saveLocalMappings({ plan_id: 1, agenda_codes: ['PA-08'], pdp_chapter_ids: [3], dost_objective_ids: [10, 11] }, catalog, { userId: 1 });
});

test('deleting an active mapping removes only that mapping', () => {
    const [first, second] = listLocalMappings(1);
    deleteLocalMapping(first.id);
    assert.deepEqual(listLocalMappings(1).map((item) => item.id), [second.id]);
    assert.equal(listLocalArchivedMappings(1).length, 0);
});

test('an archived mapping can be deleted permanently', () => {
    const [first] = listLocalMappings(1);
    archiveLocalMapping(first.id, { userId: 1 });
    deleteLocalMapping(first.id);
    assert.equal(listLocalArchivedMappings(1).length, 0);
    assert.equal(listLocalMappings(1).length, 1);
});

test('deleting a mapping that no longer exists reports it and changes nothing', () => {
    const [first] = listLocalMappings(1);
    deleteLocalMapping(first.id);
    assert.throws(() => deleteLocalMapping(first.id), /no longer exists/);
    assert.equal(listLocalMappings(1).length, 1);
});

test('a deleted chain can be mapped again as a new mapping', () => {
    const [first] = listLocalMappings(1);
    deleteLocalMapping(first.id);
    saveLocalMappings({ plan_id: 1, agenda_codes: ['PA-08'], pdp_chapter_ids: [3], dost_objective_ids: [first.dost_objective_id] }, catalog, { userId: 1 });
    const recreated = listLocalMappings(1).find((item) => item.dost_objective_id === first.dost_objective_id);
    assert.ok(recreated);
    assert.notEqual(recreated.id, first.id);
});
