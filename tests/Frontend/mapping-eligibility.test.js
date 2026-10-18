import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mappingArchiveBlockReason, mappingChangeLockReason } from '../../resources/js/mappings/mapping-eligibility.js';

test('only draft and not-submitted plans allow mapping changes', () => {
    assert.equal(mappingChangeLockReason({ status: 'draft', approval_status: 'not_submitted' }), null);
    for (const [status, approval_status] of [['draft', 'rejected'], ['finished', 'not_submitted'], ['finished', 'rejected']]) {
        assert.ok(mappingChangeLockReason({ status, approval_status }));
    }
    assert.match(mappingChangeLockReason({ status: 'draft' }), /approval state/);
    assert.match(mappingChangeLockReason({ status: 'archived' }), /archived/);
    assert.match(mappingChangeLockReason({ status: 'draft', approval_status: 'under_approval' }), /under approval/);
    assert.match(mappingChangeLockReason({ status: 'finished', approval_status: 'approved' }), /approved/);
    assert.match(mappingChangeLockReason(null), /Select a Strategic Plan/);
});

test('a mapping must exist and be active to be archived', () => {
    const plan = { status: 'draft', approval_status: 'not_submitted' };
    assert.equal(mappingArchiveBlockReason({ status: 'active' }, plan), null);
    assert.match(mappingArchiveBlockReason({ status: 'archived' }, plan), /already archived/);
    assert.match(mappingArchiveBlockReason(undefined, plan), /no longer exists/);
    assert.match(mappingArchiveBlockReason({ status: 'active' }, { status: 'finished', approval_status: 'rejected' }), /finalised/);
});
