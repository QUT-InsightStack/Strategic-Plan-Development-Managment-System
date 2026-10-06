import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';
import * as api from '../../resources/js/api/strategic-alignments-api.js';

test('alignment actions use persisted routes and send the deletion reason', async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options) => {
        calls.push({ url, ...options });
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
    });
    const mapping = { objective_id: 7, type: 'pdp-chapter', reference_id: 3 };
    await api.listPlanAlignments(4);
    await api.addAlignments(7, { pdp_chapter_ids: [3] });
    await api.replaceAlignments(7, { pdp_chapter_ids: [] });
    await api.archiveAlignment(mapping);
    await api.restoreAlignment(mapping);
    await api.updateAlignmentReference(mapping, { note: 'Source', document_id: null });
    await api.deleteAlignment(mapping, 'Incorrect link');
    assert.deepEqual(calls.map(call => [call.method || 'GET', call.url]), [
        ['GET', '/api/strategic-plans/4/alignments'],
        ['POST', '/api/strategic-objectives/7/alignments'],
        ['PUT', '/api/strategic-objectives/7/alignments'],
        ['PATCH', '/api/strategic-objectives/7/alignments/pdp-chapter/3/archive'],
        ['PATCH', '/api/strategic-objectives/7/alignments/pdp-chapter/3/restore'],
        ['PATCH', '/api/strategic-objectives/7/alignments/pdp-chapter/3/reference'],
        ['DELETE', '/api/strategic-objectives/7/alignments/pdp-chapter/3'],
    ]);
    assert.deepEqual(JSON.parse(calls.at(-1).body), { reason: 'Incorrect link' });
    assert.ok(calls.every(call => call.credentials === 'include'));
});

function page({ capabilities = {}, failArchive = false } = {}) {
    const values = [], effects = [], pending = [];
    let cursor = 0, calls = 0;
    const mapping = { id: '7:pdp-chapter:3', objective_id: 7, type: 'pdp-chapter', reference_id: 3,
        objective_title: 'Research', reference_title: 'Chapter 3', status: 'active', reference_status: 'active', objective_status: 'draft' };
    const context = vm.createContext({
        URLSearchParams, location: { search: '?plan_id=4' }, document: { getElementById: () => ({}) },
        AppSidebar: 'sidebar', AppDialog: 'dialog', mountProtectedPage: () => {},
        React: {
            Fragment: 'fragment',
            createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
            useState(initial) {
                const i = cursor++;
                if (!(i in values)) values[i] = initial;
                return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value; }];
            },
            useEffect(effect, deps) {
                const i = cursor++;
                if (!effects[i] || deps.some((value, index) => value !== effects[i].deps[index])) {
                    effects[i]?.cleanup?.();
                    effects[i] = { deps };
                    pending.push(() => { effects[i].cleanup = effect(); });
                }
            },
        },
        listStrategicPlans: async () => ({ data: [{ record_id: 4, title: 'Plan' }], meta: { last_page: 1 } }),
        listPlanAlignments: async () => ({ data: [{ ...mapping }], meta: { capabilities, objectives: [], catalog: {} } }),
        archiveAlignment: async () => {
            calls++;
            if (failArchive) throw new Error('Approval started; mapping is locked.');
            mapping.status = 'archived';
        },
    });
    const source = readFileSync(new URL('../../resources/js/pages/shared/mappings-app.js', import.meta.url), 'utf8');
    vm.runInContext(source.replace(/^import .*;\r?$/gm, '').replace('export function', 'function'), context);
    return {
        render() { cursor = 0; return context.MappingApp(); },
        async settle() {
            for (let i = 0; i < 4; i++) { this.render(); pending.splice(0).forEach(effect => effect()); await setImmediate(); }
            return this.render();
        },
        get calls() { return calls; },
    };
}
function nodes(tree, predicate) {
    if (!tree || typeof tree !== 'object') return [];
    return [...(predicate(tree) ? [tree] : []), ...tree.children.flatMap(child => nodes(child, predicate))];
}
function text(tree) {
    return tree == null || tree === false ? '' : typeof tree !== 'object' ? String(tree) : tree.children.map(text).join(' ');
}
const button = (tree, label) => nodes(tree, node => node.type === 'button' && text(node) === label)[0];

test('rejected archive stays visible after reload without false success', async () => {
    const app = page({ capabilities: { archive: true }, failArchive: true });
    let tree = await app.settle();
    button(tree, 'Archive').props.onClick();
    nodes(app.render(), node => node.type === 'dialog')[0].props.onConfirm();
    tree = await app.settle();
    assert.equal(app.calls, 1);
    assert.match(text(tree), /Approval started; mapping is locked/);
    assert.ok(button(tree, 'Archive'));
    assert.doesNotMatch(text(tree), /Alignment archived\./);
});

test('successful archive is reloaded from the server and appears in archived results', async () => {
    const app = page({ capabilities: { archive: true, restore: true } });
    let tree = await app.settle();
    button(tree, 'Archive').props.onClick();
    nodes(app.render(), node => node.type === 'dialog')[0].props.onConfirm();
    tree = await app.settle();
    assert.match(text(tree), /Alignment archived\./);
    assert.equal(button(tree, 'Archive'), undefined);
    button(tree, 'Archived (1)').props.onClick();
    tree = app.render();
    assert.ok(button(tree, 'Restore'));
    assert.match(text(tree), /Chapter 3/);
});

test('server read-only capabilities hide mapping mutation actions', async () => {
    const tree = await page().settle();
    for (const label of ['Archive', 'Restore', 'Delete', 'Add alignment', 'Reference details']) {
        assert.equal(button(tree, label), undefined);
    }
    assert.match(text(tree), /read-only/);
});
