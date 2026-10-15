import assert from 'node:assert/strict';
import test from 'node:test';
import { navigationFor, flattenNavigation, pageForUrl, canOpenPage, dashboardHrefFor, isCurrentPage } from '../../resources/js/access/navigation.js';

const stages = role => navigationFor(role).filter(item => item.children && item.id !== 'account').map(item => item.label);
const labels = (role, stage) => navigationFor(role).find(item => item.label === stage).children.map(item => item.label);
const entry = (role, id) => flattenNavigation(navigationFor(role)).find(item => item.id === id);

test('Administrative Admin workspace follows its stages and keeps the planning support groups', () => {
    assert.deepEqual(stages('Administrative Admin'), [
        'Planning reference-data preparation', 'Planning-template preparation', 'Administrative monitoring',
        'Strategic Planning', 'Strategic Alignment', 'Progress Monitoring', 'Assigned Approvals',
    ]);
    assert.deepEqual(labels('Administrative Admin', 'Planning reference-data preparation'),
        ['Presidential Agenda Management', 'PDP Chapters Management', 'Reference Data Management']);
    assert.deepEqual(labels('Administrative Admin', 'Administrative monitoring'), ['Reports', 'System Logs']);
});

test('Planning Officer workspace follows the nine planning stages', () => {
    assert.deepEqual(stages('Planning Officer'), [
        'Initial strategic-plan creation', 'Strategic foundation development', 'Strategic-objective development', 'Strategic alignment mapping',
        'Office/Agency input collection', 'Office/Agency input consolidation', 'Strategic-plan finalization', 'Approval submission',
        'Implementation monitoring', 'Reviews',
    ]);
    assert.deepEqual(labels('Planning Officer', 'Strategic alignment mapping'), ['Strategic Mapping', 'Agenda → PDP → DOST Mapping', 'PDP Chapters']);
    assert.deepEqual(labels('Planning Officer', 'Implementation monitoring'), ['Objective Progress Monitoring', 'Reports']);
    assert.deepEqual(labels('Planning Officer', 'Strategic foundation development'), ['Strategic Plan Editor', 'Mission, Vision, and Core Values']);
    assert.deepEqual(labels('Planning Officer', 'Approval submission'), ['Submit for Approval', 'Submission Status']);
    for (const id of ['plan-editor', 'mvc', 'submit-approval', 'submission-status']) {
        assert.equal(entry('Planning Officer', id).alias, true, id);
        assert.notEqual(entry('Planning Officer', id).dashboardOnly, true, `${id} is shown in the sidebar`);
    }
    assert.equal(isCurrentPage(entry('Planning Officer', 'plan-editor'), '/strategic-plans'), false, 'aliases are never highlighted');
    assert.equal(isCurrentPage(entry('Planning Officer', 'plans'), '/strategic-plans'), true, 'the first entry for the page is highlighted');
    assert.equal(pageForUrl('/strategic-plans', 'Planning Officer').id, 'plans');
    assert.equal(pageForUrl('/strategic-plans/finalize', 'Planning Officer').id, 'finalize');
});

test('Office workspace follows its stages with read-only agency mapping', () => {
    assert.deepEqual(stages('Office'), [
        'Initial strategic-plan review', 'Planning-input submission', 'Agency-level strategic mapping', 'Input-processing status review',
        'Assigned-objective progress updates', 'Agency implementation monitoring',
    ]);
    assert.deepEqual(labels('Office', 'Planning-input submission'), ['Planning Inputs', 'Proposed Objectives', 'Comments']);
    assert.equal(entry('Office', 'alignment').label, 'Agency Mapping');
    assert.equal(entry('Office', 'alignment').href, '/mappings?mode=view');
    assert.ok(labels('Office', 'Assigned-objective progress updates').includes('Edit Objectives'));
});

test('the old stage-card dashboard is gone for these roles and Technical Admin is unchanged', () => {
    for (const role of ['Administrative Admin', 'Planning Officer', 'Office']) {
        assert.equal(entry(role, 'home'), undefined);
        assert.equal(pageForUrl('/dashboard', role), undefined);
        assert.equal(dashboardHrefFor(role), '/monitoring-dashboard');
    }
    assert.equal(dashboardHrefFor('Management'), '/management-dashboard');
    assert.equal(dashboardHrefFor('Administrator'), '/dashboard');
    assert.equal(dashboardHrefFor(undefined), '/dashboard');
    assert.equal(navigationFor('Administrator')[0].id, 'home');
    assert.deepEqual(stages('Administrator'), ['Planning Support', 'Access Administration', 'Account Security']);
});

test('monitoring links open the permission-gated dashboard and report master', () => {
    for (const role of ['Administrative Admin', 'Planning Officer', 'Office']) {
        const first = navigationFor(role)[0];
        assert.equal(first.id, 'monitoring-dashboard', 'Dashboard is the first top-level menu item');
        assert.equal(first.label, 'Dashboard');
        assert.equal(first.children, undefined);
        assert.equal(entry(role, 'monitoring-dashboard').href, '/monitoring-dashboard');
        assert.equal(entry(role, 'monitoring-reports').href, '/monitoring-dashboard?tab=reports');
        assert.equal(entry(role, 'monitoring-dashboard').placeholder, undefined);
        assert.equal(pageForUrl('/monitoring-dashboard?tab=reports&period=2023-2028', role).id, 'monitoring-reports');
        assert.equal(pageForUrl('/monitoring-dashboard', role).id, 'monitoring-dashboard');
    }
    assert.equal(canOpenPage(entry('Office', 'monitoring-reports'), { permissions: ['strategic_records.view'] }), false);
    assert.equal(canOpenPage(entry('Office', 'monitoring-reports'), { permissions: ['reports.view'] }), true);
    assert.equal(canOpenPage(entry('Office', 'monitoring-dashboard'), { permissions: ['strategic_records.view'] }), true);
});
