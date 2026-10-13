import test from 'node:test';
import assert from 'node:assert/strict';
import { createPageRoot, unmountPages } from '../../resources/js/navigation/page-root.js';
import { shouldHandleLink } from '../../resources/js/navigation/sidebar-navigation.js';

test('page disposal cleans up once and ignores a late response from an old page', () => {
    const previous = globalThis.ReactDOM;
    const rendered = [];
    let disposed = 0;
    globalThis.ReactDOM = { createRoot: () => ({ render: value => rendered.push(value), unmount: () => disposed++ }) };
    try {
        const first = createPageRoot({});
        first.render('first');
        unmountPages();
        first.render('late');
        const second = createPageRoot({});
        second.render('second');
        first.unmount();
        assert.deepEqual(rendered, ['first', 'second']);
        assert.equal(disposed, 1);
        unmountPages();
        assert.equal(disposed, 2);
    } finally { globalThis.ReactDOM = previous; }
});

test('client navigation preserves browser modifiers, downloads and external links', () => {
    const event = { button: 0 };
    const anchor = { href: 'https://example.test/management-approvals', target: '', hasAttribute: () => false };
    assert.equal(shouldHandleLink(event, anchor, 'https://example.test'), true);
    for (const flag of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey', 'defaultPrevented']) {
        assert.equal(shouldHandleLink({ ...event, [flag]: true }, anchor, 'https://example.test'), false);
    }
    assert.equal(shouldHandleLink({ button: 1 }, anchor, 'https://example.test'), false);
    assert.equal(shouldHandleLink(event, { ...anchor, target: '_blank' }, 'https://example.test'), false);
    assert.equal(shouldHandleLink(event, { ...anchor, hasAttribute: () => true }, 'https://example.test'), false);
    assert.equal(shouldHandleLink(event, anchor, 'https://different.test'), false);
});
