import assert from 'node:assert/strict';
import test from 'node:test';
import { navigationFor, flattenNavigation, pageForUrl, canOpenPage, dashboardHrefFor, isCurrentPage } from '../../resources/js/access/navigation.js';
import { SIDEBAR_WIDTH, clampSidebarWidth, sidebarWidthForKey } from '../../resources/js/components/sidebar-width.js';

const ACCOUNT = ['account', 'workflow-guide', 'notifications', 'profile', 'faq'];
const menu = role => navigationFor(role).filter(item => !ACCOUNT.includes(item.id))
    .map(item => item.children ? `${item.label}: ${item.children.map(child => child.label).join(', ')}` : item.label);
const entry = (role, id) => flattenNavigation(navigationFor(role)).find(item => item.id === id);

test('Administrative Admin menu is short, without a separate Reports link', () => {
    assert.deepEqual(menu('Administrative Admin'), [
        'Dashboard',
        'Reference Data: Presidential Agenda, PDP Chapters, Templates',
        'Planning: Plan List, Create Plan, Objectives, Inputs, Finalize & Submit',
        'Alignment: Strategic Mapping, Alignment View',
        'Monitoring: Objective Progress, System Logs',
    ]);
});

test('Planning Officer menu is short, without a separate Reports link', () => {
    assert.deepEqual(menu('Planning Officer'), [
        'Dashboard',
        'Plans: Plan List, Create Plan, Objectives, Finalize & Submit',
        'Alignment: Strategic Mapping, Alignment View, PDP Chapters',
        'Planning Inputs',
        'Objective Progress',
        'Plan Reviews',
    ]);
});

test('Office menu is short, with read-only agency mapping and no monitoring group', () => {
    assert.deepEqual(menu('Office'), [
        'Dashboard',
        'Plans & Objectives',
        'Inputs: Planning Inputs, Proposed Objectives, Comments, Input Status',
        'My Objectives: Progress Update, Edit Objectives',
        'Agency Mapping',
    ]);
    assert.equal(entry('Office', 'alignment').href, '/mappings?mode=view');
});

test('each role lists every page once and keeps single items at the top level', () => {
    for (const role of ['Administrative Admin', 'Planning Officer', 'Office', 'Management', 'Technical Admin']) {
        const items = flattenNavigation(navigationFor(role)).filter(item => !item.dashboardOnly);
        assert.equal(new Set(items.map(item => item.href)).size, items.length, role);
        assert.ok(items.every(item => !item.alias), `${role} has no alias entries`);
        assert.ok(navigationFor(role).every(item => !item.children || item.children.length > 1), `${role} has no single-item groups`);
    }
});

test('Dashboard is the first link and covers its Overview and Reports tabs', () => {
    for (const role of ['Administrative Admin', 'Planning Officer', 'Office']) {
        const first = navigationFor(role)[0];
        assert.equal(first.id, 'monitoring-dashboard');
        assert.equal(first.label, 'Dashboard');
        assert.equal(first.href, '/monitoring-dashboard');
        assert.equal(pageForUrl('/monitoring-dashboard?tab=reports&period=2023-2028', role).id, 'monitoring-dashboard');
        assert.equal(isCurrentPage(first, '/monitoring-dashboard?tab=reports'), true);
        assert.equal(entry(role, 'home'), undefined);
        assert.equal(pageForUrl('/dashboard', role), undefined);
        assert.equal(dashboardHrefFor(role), '/monitoring-dashboard');
    }
    assert.equal(canOpenPage(entry('Office', 'monitoring-dashboard'), { permissions: ['strategic_records.view'] }), true);
    assert.equal(canOpenPage(entry('Office', 'monitoring-dashboard'), { permissions: [] }), false);
    assert.equal(dashboardHrefFor('Management'), '/management-dashboard');
    assert.equal(dashboardHrefFor('Administrator'), '/dashboard');
    assert.equal(navigationFor('Administrator')[0].id, 'home', 'Technical Admin is unchanged');
});

test('Office page entry lookup handles top-level links and groups', async () => {
    const { officeEntryFor } = await import('../../resources/js/access/office-navigation.js');
    assert.equal(officeEntryFor('/office').id, 'office-review');
    assert.equal(officeEntryFor('/office?view=inputs').id, 'office-upload');
    assert.equal(officeEntryFor('/office?view=progress').id, 'progress');
    assert.equal(officeEntryFor('/office?view=comments').id, 'office-comments');
    assert.equal(officeEntryFor('/office?view=edit').id, 'edit-objectives');
    assert.equal(officeEntryFor('/office?view=mapping'), undefined);
});

test('sidebar width stays between 200 and 360 pixels', () => {
    assert.equal(SIDEBAR_WIDTH.default, 260);
    assert.equal(clampSidebarWidth(120), 200);
    assert.equal(clampSidebarWidth(999), 360);
    assert.equal(clampSidebarWidth('300'), 300);
    assert.equal(clampSidebarWidth('wide'), 260);
    assert.equal(sidebarWidthForKey('ArrowRight', 260), 276);
    assert.equal(sidebarWidthForKey('ArrowLeft', 205), 200);
    assert.equal(sidebarWidthForKey('Home', 300), 200);
    assert.equal(sidebarWidthForKey('End', 300), 360);
    assert.equal(sidebarWidthForKey('Enter', 300), null);
});
