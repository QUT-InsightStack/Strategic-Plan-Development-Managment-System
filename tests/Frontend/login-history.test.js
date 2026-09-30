import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';
import test from 'node:test';
import { routeRules, policyForRole } from '../../resources/js/access/access-policy.js';
import { can } from '../../resources/js/access/access-session.js';

// Render the actual page with a minimal React host and the backend's JSON contract.
// Network and browser navigation are replaced; page state and event handlers run unchanged.
function page(entries) {
    const state = [];
    let cursor = 0;
    let root;
    let sent;
    const context = vm.createContext({
        React: {
            Fragment: 'fragment',
            createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
            useEffect: () => {},
            useState(initial) {
                const index = cursor++;
                if (!(index in state)) state[index] = initial;
                return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
            },
        },
        ReactDOM: { createRoot: () => ({ render: (element) => { root = element; } }) },
        document: { getElementById: () => ({}) },
        enforcePageAccess: () => {},
        getAccessSession: () => ({ roleName: 'Technical Administrator' }),
        AdministrativeAdminSidebar: 'aside', TechnicalAdminSidebar: 'aside', PageHeader: 'header',
        searchUsers: async () => ({ data: [] }),
        listLoginHistory: async (params) => {
            sent = JSON.parse(JSON.stringify(params));
            return { data: entries, meta: { total: entries.length, current_page: 1, last_page: 1 } };
        },
    });
    const source = readFileSync(new URL('../../resources/js/pages/technical-admin/login-history-app.js', import.meta.url), 'utf8');
    vm.runInContext(source.replace(/^import .*;\r?$/gm, ''), context);
    return {
        render() { cursor = 0; return root.type(); },
        get sent() { return sent; },
    };
}

function nodes(tree, predicate) {
    if (!tree || typeof tree !== 'object') return [];
    return [...(predicate(tree) ? [tree] : []), ...tree.children.flatMap((child) => nodes(child, predicate))];
}

function text(tree) {
    if (tree == null || tree === false) return '';
    if (typeof tree !== 'object') return String(tree);
    return tree.children.map(text).join(' ');
}

test('successful and failed backend records render their actual status, time and reason', async () => {
    const app = page([
        { login_history_id: 1, status: 'success', attempted_at: '2026-09-01T10:00:00Z', user_name: 'Historical User', email: 'user@example.com' },
        { login_history_id: 2, status: 'failed', attempted_at: '2026-09-01T11:00:00Z', failure_reason: 'account_locked', email: 'user@example.com' },
    ]);
    nodes(app.render(), (node) => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    await setImmediate();
    const rows = nodes(app.render(), (node) => node.type === 'tbody')[0].children;
    assert.match(text(rows[0]), /Successful/);
    assert.doesNotMatch(text(rows[0]), /Failed/);
    assert.match(text(rows[0]), /2026/);
    assert.match(text(rows[0]), /Historical User/);
    assert.match(text(rows[1]), /Failed/);
    assert.match(text(rows[1]), /Account locked/);
});

test('form submits canonical status and date filter names', async () => {
    const app = page([]);
    let tree = app.render();
    for (const [id, value] of [['history-outcome', 'failed'], ['history-from', '2026-09-01'], ['history-to', '2026-09-02']]) {
        nodes(tree, (node) => node.props.id === id)[0].props.onChange({ target: { value } });
        tree = app.render();
    }
    nodes(tree, (node) => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    await setImmediate();
    assert.deepEqual(app.sent, {
        user_id: '', status: 'failed', search: '', date_from: '2026-09-01', date_to: '2026-09-02', page: 1, per_page: 15,
    });
});

test('login-history navigation enforces the backend permission independently of audit access', () => {
    const permission = routeRules.find((rule) => rule.test.test('/login-history')).permission;
    assert.equal(can(permission, { permissions: ['logs.view'] }), false);
    assert.equal(can(permission, { permissions: ['login_history.view'] }), true);
    assert.equal(can(permission, policyForRole('Technical Administrator')), true);
});
