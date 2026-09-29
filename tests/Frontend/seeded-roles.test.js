import assert from 'node:assert/strict';
import test from 'node:test';
import { can, createAccessSession } from '../../resources/js/access/access-session.js';
import { policyForRole, routeRules, PERMISSIONS } from '../../resources/js/access/access-policy.js';
import { displayRoleName } from '../../resources/js/access/role-labels.js';
import { isOfficeRole } from '../../resources/js/access/office-navigation.js';
import { demoRoles } from '../../resources/js/data/role-management-demo-data.js';

test('renamed roles keep their previous navigation and fallback permissions', () => {
    assert.deepEqual(policyForRole('Management'), policyForRole('Division Head'));
    assert.deepEqual(policyForRole('Office'), policyForRole('Viewer'));
    const session = createAccessSession({ role_name: 'Office', permissions: ['strategic_records.view'] });
    assert.equal(session.home, '/strategic-plans');
    assert.equal(can(PERMISSIONS.PLANS_VIEW, session), true);
    assert.equal(can(PERMISSIONS.PLANS_CREATE, session), false);
    assert.equal(isOfficeRole('Office'), true); // The upgraded Office role uses Office navigation.
    const management = createAccessSession({ role_name: 'Management', permissions: ['strategic_records.view'] });
    assert.equal(can(PERMISSIONS.PLANS_DELETE, management), false);
});

test('test account has full permissions and can enter workflow configuration', () => {
    const session = createAccessSession({ role_name: 'test', permissions: [] });
    for (const permission of Object.values(PERMISSIONS)) assert.equal(can(permission, session), true);
    assert.equal(routeRules.find(rule => rule.test.test('/workflow-configuration')).roles.includes('test'), true);
    assert.equal(session.roleLabel, 'test');
    assert.equal(displayRoleName('Management'), 'Management');
    assert.equal(displayRoleName('Office'), 'Office');
});

test('role management demonstration uses the six seeded role names', () => {
    assert.deepEqual(demoRoles.map(role => role.name).sort(), [
        'Administrator', 'test', 'Planning Officer', 'Management', 'Office', 'Technical Administrator',
    ].sort());
});
