import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';
import test from 'node:test';
import { submissionView, processPlanDecision } from '../../resources/js/api/plan-approval-api.js';

function host(path, dependencies, planId = 7) {
    const state = [];
    const effects = [];
    let cursor = 0;
    let root;
    const context = vm.createContext({
        React: {
            Fragment: 'fragment',
            createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
            useEffect: callback => { if (state.length === cursor) effects.push(callback); },
            useState(initial) {
                const index = cursor++;
                if (!(index in state)) state[index] = initial;
                return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
            },
        },
        ReactDOM: { createRoot: () => ({ render: element => { root = element; } }) },
        document: { getElementById: () => ({ dataset: { planId } }) },
        enforcePageAccess: () => {}, AppSidebar: 'aside', PageHeader: 'header',
        ...dependencies,
    });
    const source = readFileSync(new URL(`../../resources/js/pages/${path}`, import.meta.url), 'utf8');
    vm.runInContext(source.replace(/^import [\s\S]*?;\r?\n/gm, ''), context);
    return {
        render() { cursor = 0; return root.type(); },
        async load() { this.render(); effects.splice(0).forEach(effect => effect()); await setImmediate(); return this.render(); },
    };
}

function nodes(tree, predicate) {
    if (!tree || typeof tree !== 'object') return [];
    return [...(predicate(tree) ? [tree] : []), ...tree.children.flatMap(child => nodes(child, predicate))];
}

function text(tree) {
    if (tree == null || tree === false) return '';
    return typeof tree === 'object' ? tree.children.map(text).join(' ') : String(tree);
}

const plan = {
    record_id: 7, title: 'Submitted research strategy', status: 'finished', approval_status: 'not_submitted',
    mission_foundation: { content: 'Research for all' }, vision_foundation: { content: 'Better outcomes' },
    core_values: [{ content: 'Integrity' }], creator: { first_name: 'Plan', last_name: 'Author' },
    objectives: [{ objective_id: 3, objective_title: 'Access', expected_outcome: 'Participation', indicator: 'Count', status: 'draft', comments: [] }],
    documents: [{ document_id: 12, original_filename: 'Evidence.pdf' }],
};

const record = {
    id: 5, plan_id: 7, current_sequence: 1, status: 'under_approval', submitted_at: '2026-09-21T00:00:00Z',
    workflow_snapshot: { name: 'Original workflow' }, plan_snapshot: plan,
    stages: [{ id: 9, sequence: 1, name: 'Initial review', approver_type: 'user', approver_label: 'Reviewer', reviewers: [{ user_id: 20 }] }],
    history: [{ action: 'submitted', actor_name: 'Submitting Officer', stage_id: 9, created_at: '2026-09-21T00:00:00Z' }],
};

test('review page renders the submitted snapshot and actual submitter without fetching live plan data', async () => {
    const submission = submissionView(record);
    const app = host('management/strategic-plan-review-app.js', {
        getAccessSession: () => ({ userId: 20 }),
        getPlanSubmission: async () => submission,
        isSubmissionAssignedToReviewer: () => true,
    });
    const tree = await app.load();
    assert.match(text(tree), /Submitted research strategy/);
    assert.match(text(tree), /Submitting Officer/);
    assert.match(text(tree), /Original workflow/);
    // Open the supporting document accordion and inspect the protected attachment URL.
    const accordion = nodes(tree, node => node.props.id === 'review-documents')[0];
    assert.ok(accordion);
    const link = nodes(tree, node => node.type === 'a' && node.props.href?.includes('/documents/12'))[0];
    assert.equal(link.props.href, '/api/plan-submissions/5/documents/12');
});

test('a finished plan is submitted through the approval API and only becomes submitted after success', async () => {
    let submittedId;
    const app = host('planner/strategic-plan-finalize-app.js', {
        listStrategicPlans: async () => ({ data: [plan] }), getStrategicPlan: async () => ({ data: plan }),
        listStrategicObjectives: async () => ({ data: plan.objectives }),
        apiRequest: async () => ({ data: { pending_inputs: 0 } }),
        submitStrategicPlan: async id => { submittedId = id; return { data: { status: 'under_approval' } }; },
    });
    let tree = await app.load();
    const button = nodes(tree, node => node.type === 'button' && text(node) === 'Submit for Approval')[0];
    assert.equal(button.props.disabled, false);
    button.props.onClick();
    tree = app.render();
    const dialog = nodes(tree, node => node.type?.name === 'DecisionDialog')[0];
    await dialog.props.onConfirm();
    assert.equal(submittedId, 7);
    assert.ok(nodes(app.render(), node => node.type === 'button' && text(node) === 'Submitted' && node.props.disabled).length);
});

test('decision requests include the reviewed submission and stage to reject stale decisions', async () => {
    const originalFetch = globalThis.fetch;
    let request;
    globalThis.fetch = async (url, options) => {
        request = { url, data: JSON.parse(options.body) };
        return { ok: true, status: 200, json: async () => ({ data: record }) };
    };
    try {
        await processPlanDecision({ planId: 7, submission: submissionView(record), decision: 'approve', comment: 'Reviewed' });
        assert.equal(request.url, '/api/strategic-plans/7/approval/decision');
        assert.deepEqual(request.data, { decision: 'approve', comment: 'Reviewed', submission_id: 5, stage_id: 9 });
    } finally { globalThis.fetch = originalFetch; }
});
