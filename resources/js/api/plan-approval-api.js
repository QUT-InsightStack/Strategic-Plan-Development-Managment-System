import { apiRequest } from './api-client.js';

export function submissionView(record) {
    const stages = record.stages.map(stage => ({ ...stage, approver: stage.approver_label, approverType: stage.approver_type }));
    return {
        ...record,
        planId: record.plan_id,
        submittedAt: record.submitted_at,
        submittedBy: record.history.find(item => ['submitted', 'resubmitted'].includes(item.action))?.actor_name || '',
        currentStageIndex: record.current_sequence == null ? stages.length : record.current_sequence - 1,
        currentStage: stages.find(stage => stage.sequence === record.current_sequence) || null,
        workflowSnapshot: { ...record.workflow_snapshot, stages },
        workflowName: record.workflow_snapshot.name,
        history: record.history.map(item => ({ ...item, occurredAt: item.created_at,
            stageName: stages.find(stage => stage.id === item.stage_id)?.name,
            assignedApprover: stages.find(stage => stage.id === item.stage_id)?.approver,
        })),
    };
}

export async function getPlanSubmission(planId) {
    const response = await apiRequest(`/api/strategic-plans/${planId}/approval`);
    return submissionView(response.data);
}

export async function listAssignedPlanSubmissions() {
    const submissions = [];
    let page = 1;
    let lastPage;
    do {
        const response = await apiRequest(`/api/plan-reviews?per_page=100&page=${page}`);
        submissions.push(...response.data.map(submissionView));
        lastPage = response.last_page;
        page += 1;
    } while (page <= lastPage);
    return submissions;
}

export async function processPlanDecision({ planId, submission, decision, comment }) {
    const response = await apiRequest(`/api/strategic-plans/${planId}/approval/decision`, {
        method: 'POST', body: JSON.stringify({ decision, comment, submission_id: submission.id, stage_id: submission.currentStage.id }),
    });
    return submissionView(response.data);
}

export function isSubmissionAssignedToReviewer(submission, session) {
    return submission?.status === 'under_approval' && Boolean(submission.currentStage?.reviewers
        ?.some(reviewer => Number(reviewer.user_id) === Number(session?.userId)));
}

export function submitStrategicPlan(planId) {
    return apiRequest(`/api/strategic-plans/${planId}/submit`, { method: 'POST' });
}

export function resubmitStrategicPlan(planId, previousSubmissionId, revisionNote = '') {
    return apiRequest(`/api/strategic-plans/${planId}/resubmit`, {
        method: 'POST', body: JSON.stringify({ previous_submission_id: previousSubmissionId, revision_note: revisionNote }),
    });
}

export function getApprovalStatus(planId) {
    return apiRequest(`/api/strategic-plans/${planId}/approval-status`);
}
