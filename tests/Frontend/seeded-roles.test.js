import assert from 'node:assert/strict';
import test from 'node:test';
import { can, createAccessSession } from '../../resources/js/access/access-session.js';
import { policyForRole, routeRules, PERMISSIONS } from '../../resources/js/access/access-policy.js';
import { displayRoleName } from '../../resources/js/access/role-labels.js';
import { isOfficeRole } from '../../resources/js/access/office-navigation.js';
import { assignUserRole } from '../../resources/js/api/users-api.js';

test('renamed roles keep their previous navigation and fallback permissions', () => {
    assert.equal(policyForRole('Office').home, '/office');
    const session = createAccessSession({ role_name: 'Office', permissions: ['strategic_records.view'] });
    assert.equal(session.home, '/office');
    assert.equal(can(PERMISSIONS.PLANS_VIEW, session), true);
    assert.equal(can(PERMISSIONS.PLANS_CREATE, session), false);
    assert.equal(isOfficeRole('Office'), true); // The upgraded Office role uses Office navigation.
    const management = createAccessSession({ role_name: 'Management', permissions: ['strategic_records.view'] });
    assert.equal(can(PERMISSIONS.PLANS_DELETE, management), false);
});

test('Office role can navigate to plans, objective proposals, comments, inputs, and assigned progress', () => {
    const session = createAccessSession({ role_name: 'Office' });
    assert.equal(session.home, '/office');
    assert.equal(isOfficeRole('Office'), true);
    for (const permission of [
        PERMISSIONS.PLANS_VIEW,
        PERMISSIONS.INPUTS_CREATE,
        PERMISSIONS.OBJECTIVE_COMMENTS_CREATE,
        PERMISSIONS.DOCUMENTS_UPLOAD,
        PERMISSIONS.OBJECTIVES_VIEW_PROGRESS,
        PERMISSIONS.OBJECTIVES_UPDATE_PROGRESS,
    ]) assert.equal(can(permission, session), true);
});

test('Management has its own read-only oversight dashboard permissions', () => {
    const policy = policyForRole('Management');
    const session = createAccessSession({ role_name: 'Management' });
    assert.equal(policy.home, '/management-dashboard');
    assert.equal(can(PERMISSIONS.OBJECTIVES_VIEW_PROGRESS, session), true);
    assert.equal(can(PERMISSIONS.INPUTS_VIEW, session), true);
    assert.equal(can('relations.view', session), true);
    assert.equal(can(PERMISSIONS.OBJECTIVES_UPDATE_PROGRESS, session), false);
    assert.equal(can(PERMISSIONS.OBJECTIVES_CORRECT_PROGRESS, session), false);
    assert.equal(can(PERMISSIONS.MAPPINGS_MANAGE, session), false);
});

test('test account has full permissions and can enter workflow configuration', () => {
    const session = createAccessSession({ role_name: 'test', permissions: [] });
    for (const permission of Object.values(PERMISSIONS)) assert.equal(can(permission, session), true);
    assert.equal(routeRules.find(rule => rule.test.test('/workflow-configuration')).roles.includes('test'), true);
    assert.equal(session.roleLabel, 'test');
    assert.equal(displayRoleName('Management'), 'Management');
    assert.equal(displayRoleName('Office'), 'Office');
});

test('role assignment is persisted through the authenticated user role API', async () => {
    const originalFetch = globalThis.fetch;
    let request;
    globalThis.fetch = async (url, options) => {
        request = { url, options };
        return { ok: true, status: 200, headers: new Headers(), json: async () => ({ message: 'Role assigned successfully.' }) };
    };

    try {
        await assignUserRole(42, 3);
        assert.equal(request.url, '/api/users/42/role');
        assert.equal(request.options.method, 'PUT');
        assert.deepEqual(JSON.parse(request.options.body), { role_id: 3 });
    } finally {
        globalThis.fetch = originalFetch;
    }
});
