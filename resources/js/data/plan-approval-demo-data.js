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
export function getPlanSubmissions() {
    return Object.values(
        readStorage(SUBMISSION_STORAGE_KEY, {})
    );
}

function normalizeReviewerValue(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s*\/\s*/g, '/')
        .replace(/\s+/g, ' ');
}

function reviewerCandidates(session, approverType) {
    if (!session) {
        return [];
    }

    switch (approverType) {
        case 'role':
            return [
                session.roleName,
                session.roleLabel,
            ];

        case 'office':
            return [
                session.office,
                session.department,
            ];

        case 'unit':
            return [
                session.unit,
            ];

        case 'user':
            return [
                session.name,
                session.email,
                session.userId,
            ];

        default:
            return [];
    }
}

export function isSubmissionAssignedToReviewer(
    submission,
    session
) {
    const currentStage = submission?.currentStage;

    if (
        !currentStage ||
        currentStage.status !== 'pending' ||
        !currentStage.approverType ||
        !currentStage.approver
    ) {
        return false;
    }

    const expectedReviewer = normalizeReviewerValue(
        currentStage.approver
    );

    return reviewerCandidates(
        session,
        currentStage.approverType
    ).some(
        (candidate) =>
            normalizeReviewerValue(candidate) ===
            expectedReviewer
    );
}

export function listAssignedPlanSubmissions(session) {
    return getPlanSubmissions()
        .filter(
            (submission) =>
                submission.status ===
                    'under_approval' &&
                isSubmissionAssignedToReviewer(
                    submission,
                    session
                )
        )
        .sort(
            (first, second) =>
                new Date(second.submittedAt) -
                new Date(first.submittedAt)
        );
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

function reviewerDisplayName(session) {
    return (
        session?.name ||
        session?.email ||
        session?.roleLabel ||
        session?.roleName ||
        'Authorised approver'
    );
}

function createDecisionHistoryEntry({
    decision,
    comment,
    submission,
    session,
}) {
    const currentStage = submission.currentStage;

    return {
        action:
            decision === 'approve'
                ? 'approved'
                : 'rejected',

        decision,
        comment: comment || '',

        stageSequence:
            currentStage.sequence,

        stageId:
            currentStage.stageId,

        stageName:
            currentStage.name,

        assignedApprover:
            currentStage.approver,

        decidedByUserId:
            session?.userId || null,

        decidedBy:
            reviewerDisplayName(session),

        decidedByRole:
            session?.roleName || '',

        occurredAt:
            new Date().toISOString(),
    };
}

export function processPlanDecision({
    planId,
    decision,
    comment = '',
    session,
}) {
    const normalizedDecision =
        String(decision || '')
            .trim()
            .toLowerCase();

    const normalizedComment =
        String(comment || '').trim();

    if (
        !['approve', 'reject'].includes(
            normalizedDecision
        )
    ) {
        throw new Error(
            'Select either Approve or Reject.'
        );
    }

    if (
        normalizedDecision === 'reject' &&
        !normalizedComment
    ) {
        throw new Error(
            'A reason is required when rejecting a Strategic Plan.'
        );
    }

    const submissions = readStorage(
        SUBMISSION_STORAGE_KEY,
        {}
    );

    const submission =
        submissions[String(planId)];

    if (!submission) {
        throw new Error(
            'This Strategic Plan has not been submitted for approval.'
        );
    }

    if (
        submission.status !==
        'under_approval'
    ) {
        throw new Error(
            'A decision has already been processed for this approval cycle.'
        );
    }

    if (
        submission.currentStage?.status !==
        'pending'
    ) {
        throw new Error(
            'The current workflow stage is no longer awaiting a decision.'
        );
    }

    if (
        !isSubmissionAssignedToReviewer(
            submission,
            session
        )
    ) {
        throw new Error(
            'You are not assigned to process the current workflow stage.'
        );
    }

    const updatedSubmission =
        structuredClone(submission);

    const decisionHistory =
        createDecisionHistoryEntry({
            decision: normalizedDecision,
            comment: normalizedComment,
            submission: updatedSubmission,
            session,
        });

    updatedSubmission.history = [
        ...(updatedSubmission.history || []),
        decisionHistory,
    ];

    if (normalizedDecision === 'reject') {
        updatedSubmission.status =
            'rejected';

        updatedSubmission.rejectedAt =
            decisionHistory.occurredAt;

        updatedSubmission.completedAt =
            decisionHistory.occurredAt;

        updatedSubmission.currentStage = {
            ...updatedSubmission.currentStage,
            status: 'rejected',
            decision: 'rejected',
            comment: normalizedComment,
            decidedBy:
                decisionHistory.decidedBy,
            decidedAt:
                decisionHistory.occurredAt,
        };

        submissions[String(planId)] =
            updatedSubmission;

        writeSubmissions(submissions);

        return updatedSubmission;
    }

    const stages =
        updatedSubmission.workflowSnapshot
            ?.stages || [];

    const currentStageIndex =
        Number(
            updatedSubmission.currentStageIndex
        );

    const nextStageIndex =
        currentStageIndex + 1;

    const nextStage =
        stages[nextStageIndex];

    if (nextStage) {
        updatedSubmission.currentStageIndex =
            nextStageIndex;

        updatedSubmission.currentStage = {
            sequence: nextStageIndex + 1,
            stageId: nextStage.id,
            name: nextStage.name,
            approverType:
                nextStage.approverType,
            approver: nextStage.approver,
            status: 'pending',
        };

        updatedSubmission.history.push({
            action: 'advanced',
            stageSequence:
                nextStageIndex + 1,
            stageId: nextStage.id,
            stageName: nextStage.name,
            assignedApprover:
                nextStage.approver,
            occurredAt:
                decisionHistory.occurredAt,
        });
    } else {
        updatedSubmission.status =
            'approved';

        updatedSubmission.approvedAt =
            decisionHistory.occurredAt;

        updatedSubmission.completedAt =
            decisionHistory.occurredAt;

        updatedSubmission.currentStage = {
            ...updatedSubmission.currentStage,
            status: 'approved',
            decision: 'approved',
            comment: normalizedComment,
            decidedBy:
                decisionHistory.decidedBy,
            decidedAt:
                decisionHistory.occurredAt,
        };
    }

    submissions[String(planId)] =
        updatedSubmission;

    writeSubmissions(submissions);

    return updatedSubmission;
}