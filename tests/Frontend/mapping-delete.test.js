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
    listLocalMappingDeletions,
    listLocalMappings,
    saveLocalMappings,
} = await import('../../resources/js/mappings/mapping-storage.js');
const { canDeleteMappings, mappingDeleteBlockReason } = await import('../../resources/js/mappings/mapping-eligibility.js');

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

test('each deletion is recorded with the mapping, user and time', () => {
    const [first] = listLocalMappings(1);
    deleteLocalMapping(first.id, { userId: 9, name: 'Tech Admin' });
    const [entry] = listLocalMappingDeletions(1);
    assert.equal(entry.mapping_id, first.id);
    assert.equal(entry.deleted_by, 9);
    assert.equal(entry.deleted_by_name, 'Tech Admin');
    assert.equal(entry.mapping.dost_objective_id, first.dost_objective_id);
    assert.ok(entry.deleted_at);
});

test('only Management and Technical Administrators may delete mappings', () => {
    assert.equal(canDeleteMappings({ roleName: 'Management / Executive', permissions: [] }), true);
    assert.equal(canDeleteMappings({ roleName: 'Executive', permissions: [] }), true);
    assert.equal(canDeleteMappings({ roleName: 'Technical Administrator', permissions: [] }), true);
    assert.equal(canDeleteMappings({ roleName: 'Administrator', permissions: ['*'] }), true);
    assert.equal(canDeleteMappings({ roleName: 'Planning Officer', permissions: ['relations.manage', 'relations.delete'] }), false);
    assert.equal(canDeleteMappings({ roleName: 'Office/Agency', permissions: ['relations.delete'] }), false);
    assert.equal(canDeleteMappings({ roleName: 'Viewer', permissions: [] }), false);
    assert.equal(canDeleteMappings(null), false);
});

test('protected mappings must be kept instead of deleted', () => {
    const draft = { status: 'draft' };
    assert.equal(mappingDeleteBlockReason({ status: 'active' }, draft), null);
    assert.match(mappingDeleteBlockReason({ status: 'archived' }, draft), /historical records/);
    assert.match(mappingDeleteBlockReason({ status: 'active' }, { status: 'finished' }), /finalised.*plan record/);
    assert.match(mappingDeleteBlockReason({ status: 'active' }, { status: 'draft', approval_status: 'approved' }), /approved/);
    assert.match(mappingDeleteBlockReason(undefined, draft), /no longer exists/);
});
