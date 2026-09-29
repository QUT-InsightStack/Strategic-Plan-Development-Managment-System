import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
};

const { recordApprovalDecision, submitPlanForApproval, getPlanSubmission } = await import('../../resources/js/data/plan-approval-demo-data.js');

const workflow = {
    id: 'WF-1', name: 'Approval', status: 'active',
    stages: [
        { id: 1, name: 'Planning Review', approverType: 'role', approver: 'Planning Officer' },
        { id: 2, name: 'Final Approval', approverType: 'role', approver: 'Management / Executive' },
    ],
};

beforeEach(() => {
    store.clear();
    localStorage.setItem('spdms.workflow-configuration-demo', JSON.stringify(workflow));
    submitPlanForApproval({ record_id: 7, status: 'finished' });
});

test('approving moves the plan to the next stage, then to approved', () => {
    recordApprovalDecision(7, { decision: 'approved' });
    assert.equal(getPlanSubmission(7).currentStage.name, 'Final Approval');
    assert.equal(getPlanSubmission(7).status, 'under_approval');

    recordApprovalDecision(7, { decision: 'approved', note: 'Endorsed' });
    const submission = getPlanSubmission(7);
    assert.equal(submission.status, 'approved');
    assert.equal(submission.history.at(-1).note, 'Endorsed');
});

test('returning or rejecting needs a reason and ends the submission', () => {
    assert.throws(() => recordApprovalDecision(7, { decision: 'returned', note: '  ' }), /note/);
    recordApprovalDecision(7, { decision: 'returned', note: 'Add targets' });
    assert.equal(getPlanSubmission(7).status, 'returned');
    assert.throws(() => recordApprovalDecision(7, { decision: 'approved' }), /not waiting/);
});
