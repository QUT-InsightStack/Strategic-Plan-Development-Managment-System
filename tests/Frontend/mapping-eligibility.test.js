import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mappingArchiveBlockReason, mappingChangeLockReason } from '../../resources/js/mappings/mapping-eligibility.js';

test('only draft plans outside the approval workflow allow mapping changes', () => {
    assert.equal(mappingChangeLockReason({ status: 'draft' }), null);
    assert.match(mappingChangeLockReason({ status: 'finished' }), /finalised/);
    assert.match(mappingChangeLockReason({ status: 'archived' }), /archived/);
    assert.match(mappingChangeLockReason({ status: 'draft', approval_status: 'under_approval' }), /under approval/);
    assert.match(mappingChangeLockReason({ status: 'finished', approval_status: 'approved' }), /approved/);
    assert.match(mappingChangeLockReason(null), /Select a Strategic Plan/);
});

test('a mapping must exist and be active to be archived', () => {
    const plan = { status: 'draft' };
    assert.equal(mappingArchiveBlockReason({ status: 'active' }, plan), null);
    assert.match(mappingArchiveBlockReason({ status: 'archived' }, plan), /already archived/);
    assert.match(mappingArchiveBlockReason(undefined, plan), /no longer exists/);
    assert.match(mappingArchiveBlockReason({ status: 'active' }, { status: 'finished' }), /finalised/);
});
