import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { PERMISSIONS as P } from '../../resources/js/access/access-policy.js';

const plan = { record_id: 17, title: 'Research plan', status: 'draft', level: 'strategic_plan', description: 'Original notes',
    mission_foundation: { content: 'Mission' }, vision_foundation: { content: 'Vision' }, core_values: [{ content: 'Integrity' }],
    planning_start_date: '2026-01-01', planning_end_date: '2032-12-31' };
function host(file, overrides = {}, search = '') {
    const state = [], effects = [], navigation = [];
    let cursor = 0, root, initial = true;
    const context = vm.createContext({
        React: { Fragment: 'fragment', createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
            useRef: initial => ({ current: initial }),
            useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
            useEffect: callback => { if (initial) effects.push(callback); } },
        mountProtectedPage: (_element, factory) => { root = factory(); },
        document: { getElementById: () => ({ dataset: { planId: '17' } }) }, URL, URLSearchParams,
        window: { location: { href: `http://localhost/strategic-objectives${search}`, search, assign: value => navigation.push(value), replace: value => navigation.push(value) }, history: { replaceState() {} }, addEventListener() {}, removeEventListener() {} },
        P, can: () => true, getAccessSession: () => ({}), getAssignableUnits: () => [], useDialogBehaviour: () => ({ current: null }),
        AppSidebar: 'aside', AppDialog: 'confirmation', PageHeader: 'header', ObjectiveProgressPanel: 'progress', ObjectiveFormDialog: 'objective-form', AssignUnitDialog: 'assign',
        listStrategicPlans: async () => ({ data: [plan, { ...plan, record_id: 18, title: 'Second plan' }], meta: { last_page: 1 } }),
        listResponsibleUnits: async () => ({ data: [] }),
        listStrategicObjectives: async () => ({ data: [] }),
        listAllStrategicObjectives: async () => ({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } }),
        getStrategicPlan: async () => ({ data: plan }),
        ...overrides,
    });
    const source = readFileSync(new URL(`../../resources/js/pages/planner/${file}`, import.meta.url), 'utf8');
    vm.runInContext(source.replace(/^import [\s\S]*?;\r?\n/gm, ''), context);
    return { navigation, render() { cursor = 0; const tree = root.type(); initial = false; return tree; }, async init() { this.render(); await Promise.all(effects.map(effect => effect())); await setImmediate(); return this.render(); } };
}
function nodes(tree, predicate) { return tree && typeof tree === 'object' ? [...(predicate(tree) ? [tree] : []), ...tree.children.flatMap(child => nodes(child, predicate))] : []; }
function text(tree) { return tree == null || tree === false ? '' : typeof tree !== 'object' ? String(tree) : tree.children.map(text).join(' '); }
function find(tree, id) { return nodes(tree, node => node.props.id === id)[0]; }
function button(tree, label) { return nodes(tree, node => node.type === 'button' && text(node).trim() === label)[0]; }

// Function components are not rendered by this host, so render the view and header actions directly.
function objectiveView(tree) { const element = nodes(tree, node => node.type?.name === 'ObjectiveViewDialog')[0]; return element.type(element.props); }
function headerAction(tree) { return nodes(tree, node => node.type === 'header')[0].props.actions; }
const listed = { objective_id: 42, strategic_plan_id: 17, objective_title: 'Grow research income', expected_outcome: 'More grants', target: '50 grants',
    responsible_office_agency: 'Research Office', status: 'draft', updated_at: '2026-10-01T00:00:00Z', strategic_plan: { record_id: 17, title: 'Research plan', status: 'draft' } };

test('objectives page lists objectives with a filter bar instead of a plan selector', async () => {
    const requests = [];
    const app = host('strategic-objectives-list-app.js', {
        listAllStrategicObjectives: async params => { requests.push(params); return { data: [listed], meta: { current_page: 1, last_page: 1, total: 1 } }; },
        listResponsibleUnits: async () => ({ data: [{ responsible_office_agency: 'Research Office' }] }),
    });
    let tree = await app.init();
    assert.equal(find(tree, 'selected-plan'), undefined);
    assert.match(text(tree), /Grow research income/);
    assert.match(text(tree), /Research Office/);
    assert.match(text(find(tree, 'objective-filter-plan_id')), /Second plan/);
    find(tree, 'objective-filter-plan_id').props.onChange({ target: { value: '18' } });
    await setImmediate(); tree = app.render();
    find(tree, 'objective-filter-status').props.onChange({ target: { value: 'archived' } });
    await setImmediate(); tree = app.render();
    assert.equal(requests.at(-1).plan_id, '18');
    assert.equal(requests.at(-1).status, 'archived');
    nodes(tree, node => node.type === 'button' && /Reset filters/.test(text(node)))[0].props.onClick();
    await setImmediate();
    assert.equal(requests.at(-1).plan_id, '');
    assert.equal(requests.at(-1).status, '');
});

test('maintainers who select an objective are taken to the add page with it open', async () => {
    const app = host('strategic-objectives-list-app.js', {
        listAllStrategicObjectives: async () => ({ data: [listed], meta: { current_page: 1, last_page: 1, total: 1 } }),
    });
    const tree = await app.init();
    nodes(tree, node => node.type === 'button' && text(node).trim() === 'Grow research income')[0].props.onClick({ stopPropagation() {} });
    assert.deepEqual(app.navigation, ['/strategic-plans/17/objectives?edit=42']);
});

test('objectives of approved plans open read-only even for maintainers', async () => {
    const approved = { ...listed, strategic_plan: { ...listed.strategic_plan, approval_status: 'approved' } };
    const app = host('strategic-objectives-list-app.js', {
        listStrategicPlans: async () => ({ data: [], meta: { last_page: 1 } }),
        listAllStrategicObjectives: async () => ({ data: [approved], meta: { current_page: 1, last_page: 1, total: 1 } }),
    });
    let tree = await app.init();
    nodes(tree, node => node.props.className === 'objectives-register__row')[0].props.onClick();
    tree = app.render();
    const view = objectiveView(tree);
    assert.equal(app.navigation.length, 0);
    assert.match(text(view), /View Strategic Objective/);
    assert.match(text(view), /50 grants/);
    assert.equal(nodes(view, node => ['input', 'textarea', 'select'].includes(node.type)).length, 0, 'the view has no editable fields');
    assert.equal(nodes(view, node => node.type === 'a').length, 0);
});

test('read-only accounts get no link to the add page and no add button', async () => {
    const app = host('strategic-objectives-list-app.js', {
        can: permission => permission === P.OBJECTIVES_VIEW,
        listAllStrategicObjectives: async () => ({ data: [listed], meta: { current_page: 1, last_page: 1, total: 1 } }),
    });
    let tree = await app.init();
    assert.equal(headerAction(tree), null);
    nodes(tree, node => node.props.className === 'objectives-register__row')[0].props.onClick();
    tree = app.render();
    const view = objectiveView(tree);
    assert.match(text(view), /Grow research income/);
    assert.equal(nodes(view, node => node.type === 'a').length, 0);
});

test('add objective opens the add page for the filtered plan', async () => {
    const app = host('strategic-objectives-list-app.js');
    let tree = await app.init();
    headerAction(tree).props.onClick(); tree = app.render();
    assert.equal(app.navigation.length, 0);
    assert.match(text(tree), /Choose a Strategic Plan/);
    find(tree, 'objective-filter-plan_id').props.onChange({ target: { value: '17' } });
    await setImmediate(); tree = app.render();
    headerAction(tree).props.onClick();
    assert.deepEqual(app.navigation, ['/strategic-plans/17/objectives?create=1']);
});

test('old plan_id deep links preserve create/edit intent and use the original page', async () => {
    const app = host('strategic-objectives-list-app.js', {}, '?plan_id=17&edit=42');
    await app.init();
    assert.deepEqual(app.navigation, ['/strategic-plans/17/objectives?edit=42']);
});

test('plan page renders screenshot sections and adds multiple objectives to the same plan', async () => {
    const saves = [], items = [];
    const app = host('strategic-objectives-app.js', {
        createStrategicObjective: async data => { saves.push(data); const item = { ...data, objective_id: items.length + 1 }; items.push(item); return { data: item }; },
        listStrategicObjectives: async id => { assert.equal(id, '17'); return { data: [...items] }; },
    });
    let tree = await app.init();
    assert.match(text(tree), /Plan Summary/);
    assert.match(text(tree), /Notes\/Comment/);
    assert.ok(nodes(tree, node => node.type === 'th' && text(node) === 'Target').length);
    for (const title of ['First', 'Second']) {
        button(tree, 'Add Objective').props.onClick(); tree = app.render();
        const form = nodes(tree, node => node.type === 'objective-form')[0];
        await form.props.onSave({ objective_title: title, expected_outcome: 'Outcome', target: '50 projects', strategic_plan_id: 999 });
        tree = app.render();
    }
    assert.deepEqual(saves.map(data => data.strategic_plan_id), [17, 17]);
    assert.match(text(tree), /First/); assert.match(text(tree), /Second/);
    assert.match(text(tree), /50 projects/);
    assert.equal(nodes(tree, node => node.type === 'table')[0].children.length, 2, 'notes must be outside the table');
});

test('draft save preserves fresh plan fields and next opens mapping for the same plan', async () => {
    const saved = [];
    const app = host('strategic-objectives-app.js', {
        updateStrategicPlan: async (id, payload) => { saved.push({ id, payload }); return { data: { ...plan, ...payload } }; },
    });
    let tree = await app.init();
    find(tree, 'plan-notes').props.onChange({ target: { value: 'New notes' } }); tree = app.render();
    await button(tree, 'Save as a draft').props.onClick(); tree = app.render();
    assert.equal(saved[0].id, '17');
    assert.equal(saved[0].payload.description, 'New notes');
    assert.equal(saved[0].payload.mission, 'Mission');
    assert.equal(saved[0].payload.vision, 'Vision');
    assert.equal(saved[0].payload.core_values[0], 'Integrity');
    assert.equal(saved[0].payload.planning_end_date, '2032-12-31');
    assert.equal(saved[0].payload.status, 'draft');
    await button(tree, 'Next: Strategic Mapping').props.onClick();
    assert.deepEqual(app.navigation, ['/mappings?plan_id=17']);
    assert.equal(saved.length, 1, 'unchanged notes are not saved twice');
});

test('failed note save stays on the page and keeps the entered text', async () => {
    const app = host('strategic-objectives-app.js', { updateStrategicPlan: async () => { throw new Error('Save rejected'); } });
    let tree = await app.init(); find(tree, 'plan-notes').props.onChange({ target: { value: 'Keep this note' } }); tree = app.render();
    await button(tree, 'Next: Strategic Mapping').props.onClick(); tree = app.render();
    assert.equal(app.navigation.length, 0); assert.match(text(tree), /Save rejected/);
    assert.equal(find(tree, 'plan-notes').props.value, 'Keep this note');
});

test('finished plans cannot be reset to draft and read-only accounts cannot edit objectives', async () => {
    const app = host('strategic-objectives-app.js', { getStrategicPlan: async () => ({ data: { ...plan, status: 'finished' } }), can: permission => permission === P.OBJECTIVES_VIEW });
    const tree = await app.init();
    assert.equal(find(tree, 'plan-notes').props.readOnly, true);
    assert.equal(button(tree, 'Save as a draft').props.disabled, true);
    assert.equal(button(tree, 'Add Objective'), undefined);
});


test('objective archive and deletion still use existing APIs and confirmation', async () => {
    const calls = [];
    const objective = { objective_id: 3, objective_title: 'Existing objective', status: 'draft' };
    const app = host('strategic-objectives-app.js', {
        listStrategicObjectives: async () => ({ data: [objective] }),
        updateStrategicObjectiveStatus: async (id, action) => calls.push({ id, action }),
        deleteStrategicObjective: async id => calls.push({ id, action: 'delete' }),
    });
    let tree = await app.init();
    for (const action of ['Archive', 'Delete']) {
        nodes(tree, node => node.props['aria-label'] === `${action} Existing objective`)[0].props.onClick();
        assert.equal(calls.length, action === 'Archive' ? 0 : 1, 'opening confirmation does not mutate data');
        tree = app.render();
        await nodes(tree, node => node.type === 'confirmation')[0].props.onConfirm();
        tree = app.render();
    }
    assert.deepEqual(calls, [{ id: 3, action: 'archived' }, { id: 3, action: 'delete' }]);
});

test('saving notes does not revert a plan that became finished after the page loaded', async () => {
    let fetches = 0, writes = 0;
    const app = host('strategic-objectives-app.js', {
        getStrategicPlan: async () => ({ data: { ...plan, status: ++fetches === 1 ? 'draft' : 'finished' } }),
        updateStrategicPlan: async () => { writes++; },
    });
    let tree = await app.init();
    find(tree, 'plan-notes').props.onChange({ target: { value: 'New note' } }); tree = app.render();
    await button(tree, 'Save as a draft').props.onClick(); tree = app.render();
    assert.equal(writes, 0); assert.match(text(tree), /no longer a draft/);
});
