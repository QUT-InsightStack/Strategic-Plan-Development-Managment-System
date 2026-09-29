const WORKFLOW_STORAGE_KEY =
    'spdms.workflow-configuration-demo';

const SUBMISSION_STORAGE_KEY =
    'spdms.plan-approval-submissions-demo';

function readStorage(key, fallback) {
    try {
        const storedValue = JSON.parse(
            localStorage.getItem(key)
        );

        return storedValue ?? fallback;
    } catch {
        return fallback;
    }
}

function writeSubmissions(submissions) {
    localStorage.setItem(
        SUBMISSION_STORAGE_KEY,
        JSON.stringify(submissions)
    );
}

export function getActiveApprovalWorkflow() {
    const workflow = readStorage(
        WORKFLOW_STORAGE_KEY,
        null
    );

    if (
        !workflow ||
        workflow.status !== 'active' ||
        !Array.isArray(workflow.stages) ||
        workflow.stages.length === 0
    ) {
        return null;
    }

    return workflow;
}

export function getPlanSubmission(planId) {
    const submissions = readStorage(
        SUBMISSION_STORAGE_KEY,
        {}
    );

    return submissions[String(planId)] || null;
}

export function applySubmissionToPlan(plan) {
    const submission = getPlanSubmission(
        plan.record_id
    );

    if (!submission) {
        return plan;
    }

    return {
        ...plan,
        approval_status: submission.status,
        approval_stage: submission.currentStage,
        approval_submission: submission,
    };
}

export function submitPlanForApproval(plan) {
    const planId = String(plan.record_id);
    const submissions = readStorage(
        SUBMISSION_STORAGE_KEY,
        {}
    );

    if (submissions[planId]) {
        throw new Error(
            'This Strategic Plan has already been submitted for approval.'
        );
    }

    if (plan.status !== 'finished') {
        throw new Error(
            'Only a finished Strategic Plan can be submitted for approval.'
        );
    }

    const activeWorkflow =
        getActiveApprovalWorkflow();

    if (!activeWorkflow) {
        throw new Error(
            'Submission is unavailable because no active approval workflow has been configured. Please contact the Technical Administrator.'
        );
    }

    const firstStage = activeWorkflow.stages[0];

    if (
        !firstStage ||
        !firstStage.name ||
        !firstStage.approver
    ) {
        throw new Error(
            'The active approval workflow does not contain a valid first approval stage.'
        );
    }

    /*
     * A snapshot is stored so that later changes to the
     * configured workflow do not alter this submitted plan.
     */
    const workflowSnapshot = structuredClone(
        activeWorkflow
    );

    const submission = {
        planId: plan.record_id,
        status: 'under_approval',
        submittedAt: new Date().toISOString(),

        workflowId: activeWorkflow.id,
        workflowName: activeWorkflow.name,
        workflowSnapshot,

        currentStageIndex: 0,
        currentStage: {
            sequence: 1,
            stageId: firstStage.id,
            name: firstStage.name,
            approverType: firstStage.approverType,
            approver: firstStage.approver,
            status: 'pending',
        },

        history: [
            {
                action: 'submitted',
                stageSequence: 1,
                stageName: firstStage.name,
                assignedApprover:
                    firstStage.approver,
                occurredAt:
                    new Date().toISOString(),
            },
        ],
    };

    submissions[planId] = submission;
    writeSubmissions(submissions);

    return submission;
}

export const APPROVAL_DECISIONS = Object.freeze([
    'approved',
    'returned',
    'rejected',
]);

/*
 * Records an approver's decision on the plan's current stage.
 *
 * Approving moves the plan to the next stage of the workflow snapshot taken
 * at submission, or marks it approved after the final stage. Returning or
 * rejecting ends the submission and needs a note explaining why. The caller
 * is responsible for only offering this to the assigned approver.
 */
export function recordApprovalDecision(
    planId,
    { decision, note = '', decidedBy = '' }
) {
    if (!APPROVAL_DECISIONS.includes(decision)) {
        throw new Error('Choose approve, return, or reject.');
    }

    const trimmedNote = String(note || '').trim();

    if (decision !== 'approved' && !trimmedNote) {
        throw new Error(
            'Add a note explaining why the plan is being returned or rejected.'
        );
    }

    const submissions = readStorage(
        SUBMISSION_STORAGE_KEY,
        {}
    );
    const key = String(planId);
    const submission = submissions[key];

    if (
        !submission ||
        submission.status !== 'under_approval' ||
        submission.currentStage?.status !== 'pending'
    ) {
        throw new Error(
            'This Strategic Plan is not waiting for an approval decision.'
        );
    }

    const stages =
        submission.workflowSnapshot?.stages || [];
    const occurredAt = new Date().toISOString();
    const current = submission.currentStage;
    const nextIndex =
        submission.currentStageIndex + 1;
    const nextStage =
        decision === 'approved'
            ? stages[nextIndex]
            : null;

    const history = [
        ...(submission.history || []),
        {
            action: decision,
            stageSequence: current.sequence,
            stageName: current.name,
            assignedApprover: current.approver,
            decidedBy,
            note: trimmedNote,
            occurredAt,
        },
    ];

    const updated = nextStage
        ? {
              ...submission,
              currentStageIndex: nextIndex,
              currentStage: {
                  sequence: nextIndex + 1,
                  stageId: nextStage.id,
                  name: nextStage.name,
                  approverType: nextStage.approverType,
                  approver: nextStage.approver,
                  status: 'pending',
              },
              history,
          }
        : {
              ...submission,
              status: decision,
              decidedAt: occurredAt,
              currentStage: {
                  ...current,
                  status: decision,
              },
              history,
          };

    submissions[key] = updated;
    writeSubmissions(submissions);

    return updated;
}
