import assert from 'node:assert/strict';
import test from 'node:test';
import { navigationFor, flattenNavigation, pageForUrl, canOpenPage } from '../../resources/js/access/navigation.js';
import { ManagementPagination, pageRows } from '../../resources/js/components/ManagementPagination.js';

const management = () => flattenNavigation(navigationFor('Management'));

test('management menu opens the matching review, alignment, monitoring and report content', () => {
    assert.ok(navigationFor('Management').every(item => !item.children), 'Management sidebar links are all top-level');
    const items = management();
    const byId = id => items.find(item => item.id === id);
    assert.equal(byId('home'), undefined);
    assert.equal(byId('approval-list').href, '/management-approvals');
    assert.equal(byId('plan-review').href, '/management-plan-review');
    assert.equal(byId('objectives-review').href, '/management-plan-review?view=objectives');
    assert.equal(byId('alignment-review').href, '/management-dashboard?tab=alignment');
    assert.equal(byId('agency-input-review').href, '/management-dashboard?tab=alignment&section=agency');
    assert.equal(byId('monitoring').href, '/management-dashboard?tab=dashboard');
    assert.equal(byId('reports').href, '/management-dashboard?tab=reports');
    assert.equal(pageForUrl('/management-dashboard?tab=alignment', 'Management').id, 'alignment-review');
    assert.equal(pageForUrl('/management-dashboard?tab=alignment&section=documents', 'Management').id, 'alignment-review');
    assert.equal(pageForUrl('/management-dashboard?tab=alignment&section=agency', 'Management').id, 'agency-input-review');
    assert.equal(pageForUrl('/management-dashboard', 'Management').id, 'monitoring');
    assert.equal(pageForUrl('/management-dashboard?tab=reports', 'Management').id, 'reports');
    assert.equal(pageForUrl('/management-plan-review?view=objectives&plan=7', 'Management').id, 'objectives-review');
});

test('management alignment and objective review links require their view permissions', () => {
    const items = management();
    assert.equal(canOpenPage(items.find(item => item.id === 'alignment-review'), { permissions: ['relations.view'] }), true);
    assert.equal(canOpenPage(items.find(item => item.id === 'alignment-review'), { permissions: [] }), false);
    assert.equal(canOpenPage(items.find(item => item.id === 'objectives-review'), { permissions: ['strategic_records.view'] }), false);
    assert.equal(canOpenPage(items.find(item => item.id === 'objectives-review'), { permissions: ['strategic_records.view', 'strategic_objectives.view'] }), true);
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
