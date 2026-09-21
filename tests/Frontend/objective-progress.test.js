import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';
import test from 'node:test';
import { calculatedProgressStatus, progressStatusLabel, updateObjectiveProgress } from '../../resources/js/api/objective-progress-api.js';
import { PERMISSIONS } from '../../resources/js/access/access-policy.js';

function panel(roleName) {
    const state = [], effects = [];
    let cursor = 0, sent;
    const context = vm.createContext({
        React: {
            Fragment: 'fragment',
            createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
            useState(initial) {
                const index = cursor++;
                if (!(index in state)) state[index] = initial;
                return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
            },
            useEffect: effect => effects.push(effect),
        },
        can: () => true, getAccessSession: () => ({ roleName }), P: PERMISSIONS,
        calculatedProgressStatus, progressStatusLabel,
        listObjectiveProgress: async () => ({ data: [{ objective_id: 7, objective_title: 'Research capability', progress_percentage: 40, progress_status: 'in_progress', status: 'published', strategic_plan: { title: 'Plan', status: 'finished' } }], meta: { last_page: 1, total: 1 } }),
        listObjectiveProgressHistory: async () => ({ data: [], meta: { last_page: 1 } }),
        updateObjectiveProgress: async (...args) => { sent = args; },
    });
    const source = readFileSync(new URL('../../resources/js/strategic-objectives/ObjectiveProgressPanel.js', import.meta.url), 'utf8');
    vm.runInContext(source.replace(/^import .*;\r?$/gm, '').replace('export function', 'function'), context);
    return {
        render() { cursor = 0; effects.length = 0; return context.ObjectiveProgressPanel({}); },
        async load() { this.render(); effects.forEach(effect => effect()); await setImmediate(); },
        get sent() { return sent; },
    };
}

function nodes(tree, predicate) {
    if (!tree || typeof tree !== 'object') return [];
    return [...(predicate(tree) ? [tree] : []), ...tree.children.flatMap(child => nodes(child, predicate))];
}
function text(tree) {
    return tree == null || tree === false ? '' : typeof tree !== 'object' ? String(tree) : tree.children.map(text).join(' ');
}

test('planner form displays calculated status and requires a correction reason', async () => {
    const app = panel('Planning Officer');
    await app.load();
    let tree = app.render();
    nodes(tree, node => node.type === 'button' && text(node) === 'Update progress')[0].props.onClick();
    tree = app.render();
    assert.equal(nodes(tree, node => node.type === 'textarea')[0].props.required, true);
    assert.equal(nodes(tree, node => node.props.type === 'submit')[0].props.disabled, true);
    const form = nodes(tree, node => node.type === 'form')[0];
    assert.equal(nodes(form, node => node.type === 'select').length, 0);
    nodes(form, node => node.props.type === 'number')[0].props.onChange({ target: { value: '100' } });
    nodes(form, node => node.type === 'textarea')[0].props.onChange({ target: { value: 'Verified completion' } });
    tree = app.render();
    assert.match(text(tree), /Calculated status: Completed/);
    await nodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    assert.deepEqual(app.sent, [7, '100', 'Verified completion']);
});

test('office form permits an update without a correction reason', async () => {
    const app = panel('Responsible Unit User');
    await app.load();
    nodes(app.render(), node => node.type === 'button' && text(node) === 'Update progress')[0].props.onClick();
    const tree = app.render();
    assert.equal(nodes(tree, node => node.type === 'textarea')[0].props.required, false);
    assert.equal(nodes(tree, node => node.props.type === 'submit')[0].props.disabled, false);
});

test('progress API sends only a numeric percentage and reason, never an independent status', async () => {
    const original = globalThis.fetch;
    let sent;
    globalThis.fetch = async (url, options) => {
        sent = { url, ...options };
        return { ok: true, status: 200, json: async () => ({ success: true }) };
    };
    try {
        await updateObjectiveProgress(7, '100', ' Verified ');
        assert.equal(sent.url, '/api/strategic-objectives/7/progress');
        assert.equal(sent.method, 'PATCH');
        assert.deepEqual(JSON.parse(sent.body), { progress_percentage: 100, reason: 'Verified' });
    } finally { globalThis.fetch = original; }
});
