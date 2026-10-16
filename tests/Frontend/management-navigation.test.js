import assert from 'node:assert/strict';
import test from 'node:test';
import { navigationFor, flattenNavigation, pageForUrl, canOpenPage, isCurrentPage, managementDashboardTab } from '../../resources/js/access/navigation.js';
import { ManagementPagination, pageRows } from '../../resources/js/components/ManagementPagination.js';

const management = () => flattenNavigation(navigationFor('Management'));

test('management menu is a short flat list with Reports inside the Dashboard', () => {
    const top = navigationFor('Management').filter(item => !['workflow-guide', 'notifications', 'profile', 'faq'].includes(item.id));
    assert.deepEqual(top.map(item => item.label), ['Dashboard', 'Approvals', 'Plan Review', 'Alignment', 'Input Review']);
    assert.ok(navigationFor('Management').every(item => !item.children), 'Management links are all top-level');
    const items = management();
    const byId = id => items.find(item => item.id === id);
    assert.equal(byId('home'), undefined);
    assert.equal(byId('reports'), undefined, 'Reports is a Dashboard tab, not a separate link');
    assert.equal(byId('dashboard').href, '/management-dashboard');
    assert.equal(byId('reviews-approvals').href, '/management-dashboard?tab=approvals');
    assert.equal(byId('alignment-performance').href, '/management-dashboard?tab=alignment');
    assert.equal(byId('inputs-consolidation').href, '/management-dashboard?tab=inputs');
    assert.equal(byId('plan-review').href, '/management-plan-review');
    assert.equal(new Set(items.map(item => item.href)).size, items.length, 'each page once');
    assert.equal(pageForUrl('/management-dashboard', 'Management').id, 'dashboard');
    assert.equal(pageForUrl('/management-dashboard?tab=overview&period=2023-2028', 'Management').id, 'dashboard');
    assert.equal(pageForUrl('/management-dashboard?tab=reports', 'Management').id, 'dashboard', 'the Dashboard link stays highlighted on its Reports tab');
    assert.equal(pageForUrl('/management-dashboard?tab=alignment', 'Management').id, 'alignment-performance');
    assert.equal(pageForUrl('/management-dashboard?tab=alignment&section=documents', 'Management').id, 'alignment-performance');
    assert.equal(pageForUrl('/management-dashboard?tab=inputs', 'Management').id, 'inputs-consolidation');
    assert.equal(pageForUrl('/management-dashboard?tab=approvals&queue=returned', 'Management').id, 'reviews-approvals');
    assert.equal(isCurrentPage(byId('dashboard'), '/management-dashboard?tab=approvals'), false);
});

test('old management dashboard links resolve to the matching tab', () => {
    assert.equal(pageForUrl('/management-dashboard?tab=dashboard', 'Management').id, 'dashboard');
    assert.equal(pageForUrl('/management-dashboard?tab=monitoring', 'Management').id, 'dashboard');
    assert.equal(pageForUrl('/management-dashboard?tab=alignment&section=agency', 'Management').id, 'inputs-consolidation');
    assert.equal(managementDashboardTab(new URLSearchParams('tab=dashboard')), 'overview');
    assert.equal(managementDashboardTab(new URLSearchParams('')), 'overview');
    assert.equal(managementDashboardTab(new URLSearchParams('tab=unknown')), 'overview');
    assert.equal(managementDashboardTab(new URLSearchParams('tab=approvals')), 'approvals');
});

test('management menu has no administration, security, backup or delete entries', () => {
    const items = management();
    assert.ok(items.every(item => !/admin|security|backup|delete|role|user/i.test(`${item.id} ${item.href}`)));
});

test('management alignment link requires its view permission', () => {
    const items = management();
    assert.equal(canOpenPage(items.find(item => item.id === 'alignment-performance'), { permissions: ['strategic_records.view', 'strategic_objectives.view'] }), true);
    assert.equal(canOpenPage(items.find(item => item.id === 'alignment-performance'), { permissions: [] }), false);
    assert.equal(canOpenPage(items.find(item => item.id === 'inputs-consolidation'), { permissions: ['strategic_records.view'] }), false);
});

test('management list pagination exposes each record once', () => {
    const rows = Array.from({ length: 24 }, (_, index) => index + 1);
    assert.deepEqual(pageRows(rows, 1), rows.slice(0, 10));
    assert.deepEqual(pageRows(rows, 2), rows.slice(10, 20));
    assert.deepEqual(pageRows(rows, 3), rows.slice(20));
    assert.deepEqual(pageRows(rows, 2, 8), rows.slice(8, 16));
});

test('pagination exposes the current page and bounded controls', () => {
    const previousReact = globalThis.React;
    globalThis.React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(Boolean) }) };
    try {
        const tree = ManagementPagination({ page: 2, total: 24, onChange() {} });
        const buttons = tree.children.flatMap(child => child.children || []).filter(child => child.type === 'button');
        assert.equal(buttons.find(button => button.props['aria-current'] === 'page').children[0], 2);
        assert.equal(buttons.find(button => button.children[0] === 'Previous').props.disabled, false);
        assert.equal(buttons.find(button => button.children[0] === 'Next').props.disabled, false);
    } finally {
        globalThis.React = previousReact;
    }
});
