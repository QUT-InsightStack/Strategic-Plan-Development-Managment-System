import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';

const plan = { record_id: 17, title: 'Initial plan', status: 'draft', core_values: [] };
const treeNodes = (tree, predicate) => tree && typeof tree === 'object'
    ? [...(predicate(tree) ? [tree] : []), ...tree.children.flatMap(child => treeNodes(child, predicate))] : [];

function host(file, globals = {}) {
    const state = [];
    const effects = [];
    let cursor = 0;
    let first = true;
    const context = vm.createContext({
        React: {
            Fragment: 'fragment',
            createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
            useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
            useEffect: callback => { if (first) effects.push(callback); },
        },
        window: { addEventListener() {}, removeEventListener() {} },
        getAccessSession: () => ({ office: 'ICT Office' }),
        objectivesAssignedToOffice: objectives => objectives,
        can: () => true,
        ...globals,
    });
    const source = readFileSync(new URL(`../../resources/js/pages/office/${file}`, import.meta.url), 'utf8')
        .replace(/^import [\s\S]*?;\r?\n/gm, '')
        .replace('export function ', 'function ');
    const name = file === 'office-plan-detail.js' ? 'OfficePlanDetail' : 'OfficeComments';
    vm.runInContext(`${source}\nglobalThis.ExportedComponent = ${name};`, context);
    return {
        render(props) { cursor = 0; const tree = context.ExportedComponent(props); first = false; return tree; },
        async load(props) { cursor = 0; context.ExportedComponent(props); first = false; effects.forEach(effect => effect()); await setImmediate(); return this.render(props); },
    };
}

test('plan review is read-only while comments and proposals use separate fixed action panels', async () => {
    for (const mode of ['review', 'comments', 'proposal']) {
        const calls = [];
        const component = host('office-plan-detail.js', {
            OfficeComments: 'action-panel',
            getStrategicPlan: async (id, params) => { calls.push(['plan', id, params.include_all_office_plans]); return { data: plan }; },
            listStrategicObjectives: async (id, params) => { calls.push(['objectives', id, params.include_all_office_plans]); return { data: [] }; },
        });
        const tree = await component.load({ planId: 17, mode, includeAllOfficePlans: true });
        const actions = treeNodes(tree, node => node.type === 'action-panel');
        assert.equal(actions.length, mode === 'review' ? 0 : 1, mode);
        if (actions.length) assert.equal(actions[0].props.mode, mode);
        assert.equal(tree.props.className.includes('office-detail--with-action'), mode !== 'review');
        assert.equal(treeNodes(tree, node => node.props.className === 'office-detail-scroll').length, 1);
        assert.deepEqual(calls.map(call => [...call]), [['plan', 17, 1], ['objectives', 17, 1]]);
    }
});

test('proposal panel sends a plan-level objective proposal without a comment form', async () => {
    const requests = [];
    const component = host('office-comments.js', {
        submitPlanInput: async (...args) => { requests.push(args); },
        listStrategicPlanComments: async () => ({ data: [] }),
    });
    let tree = component.render({ plan, mode: 'proposal' });
    assert.equal(treeNodes(tree, node => node.props.id === 'office-plan-comment').length, 0);
    const title = treeNodes(tree, node => node.props.placeholder === 'Proposed objective')[0];
    title.props.onChange({ target: { value: 'New objective' } });
    tree = component.render({ plan, mode: 'proposal' });
    await treeNodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    assert.equal(requests.length, 1);
    assert.equal(requests[0][0], 17);
    assert.equal(requests[0][1].input_type, 'change_request');
    assert.match(requests[0][1].content, /Proposed objective: New objective/);
    assert.equal('objective_id' in requests[0][1], false);
});

test('comment panel submits against the plan and contains no objective proposal fields', async () => {
    const requests = [];
    const component = host('office-comments.js', {
        addStrategicPlanComment: async (...args) => { requests.push(args); },
        listStrategicPlanComments: async () => ({ data: [], meta: { last_page: 1 } }),
    });
    let tree = component.render({ plan, mode: 'comments' });
    assert.equal(treeNodes(tree, node => node.props.placeholder === 'Proposed objective').length, 0);
    treeNodes(tree, node => node.props.id === 'office-plan-comment')[0].props.onChange({ target: { value: 'Plan-level feedback' } });
    tree = component.render({ plan, mode: 'comments' });
    await treeNodes(tree, node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} });
    assert.deepEqual(requests, [[17, 'Plan-level feedback']]);
});
