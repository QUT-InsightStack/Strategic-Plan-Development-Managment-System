/*
 * Summaries for the Management dashboard.
 *
 * Everything here is a pure function of records already loaded for the
 * viewer, so the dashboard never writes planning data while building its
 * summaries, and the functions can be tested without a browser.
 */

export const APPROVAL_LABELS = Object.freeze({
    not_submitted: 'Not submitted',
    under_approval: 'Awaiting approval',
    approved: 'Approved',
    returned: 'Returned',
    rejected: 'Rejected',
});

export const PLAN_STATUS_LABELS = Object.freeze({ draft: 'Draft', finished: 'Finished', archived: 'Archived' });
export const OBJECTIVE_STATUS_LABELS = Object.freeze({ draft: 'Draft', published: 'Published', archived: 'Archived' });
export const PROGRESS_STATUS_LABELS = Object.freeze({
    not_started: 'Not started',
    in_progress: 'In progress',
    blocked: 'Blocked',
    completed: 'Completed',
});
export const INPUT_STATUS_LABELS = Object.freeze({
    pending: 'Pending review',
    accepted: 'Accepted',
    merged: 'Merged',
    returned: 'Returned',
    rejected: 'Rejected',
});

export const RISK_THRESHOLDS = Object.freeze({
    approvalOverdueDays: 14,
    inputReviewOverdueDays: 7,
    progressStaleDays: 30,
});

export const UNASSIGNED_UNIT = 'Unassigned';
const DAY = 24 * 60 * 60 * 1000;

export const emptyFilters = Object.freeze({
    plan: '',
    period: '',
    office: '',
    planStatus: '',
    objectiveStatus: '',
    approvalStatus: '',
});

function toTime(value) {
    const time = value ? new Date(value).getTime() : NaN;
    return Number.isNaN(time) ? null : time;
}

function daysSince(value, now) {
    const time = toTime(value);
    return time === null ? null : Math.floor((now - time) / DAY);
}

function clampPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.min(100, Math.max(0, Math.round(number)));
}

export function percent(part, total) {
    return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function approvalStatusOf(plan) {
    return plan?.approval_status || 'not_submitted';
}

export function planPeriod(plan) {
    const time = toTime(plan?.created_at) ?? toTime(plan?.updated_at);
    return time === null ? '' : String(new Date(time).getFullYear());
}

export function unitOf(objective) {
    const assigned = objective?.responsible_unit_assignment?.responsible_unit;
    const name = objective?.responsible_office_agency || assigned?.responsible_office_agency;
    return String(name || '').trim() || UNASSIGNED_UNIT;
}

/** Latest progress update per objective, keyed by objective id. */
export function latestProgressByObjective(updates = []) {
    const latest = new Map();

    updates
        .filter((update) => update?.kind === 'progress' && update.objective_id)
        .forEach((update) => {
            const key = String(update.objective_id);
            const current = latest.get(key);
            if (!current || (toTime(update.created_at) ?? 0) >= (toTime(current.created_at) ?? 0)) {
                latest.set(key, update);
            }
        });

    return latest;
}

/** Objective ids that appear in at least one active alignment mapping. */
export function alignedObjectiveIds(mappings = []) {
    const ids = new Set();

    mappings
        .filter((mapping) => !mapping.status || mapping.status === 'active')
        .forEach((mapping) => {
            if (mapping.dost_objective_id) ids.add(String(mapping.dost_objective_id));
            if (mapping.agency_objective_id) ids.add(String(mapping.agency_objective_id));
        });

    return ids;
}

/** Options for each filter, built from what the viewer can actually see. */
export function filterOptions({ plans = [], objectives = [] }) {
    const periods = [...new Set(plans.map(planPeriod).filter(Boolean))].sort().reverse();
    const offices = [...new Set(objectives.map(unitOf))]
        .sort((a, b) => (a === UNASSIGNED_UNIT) - (b === UNASSIGNED_UNIT) || a.localeCompare(b));

    return {
        plans: plans
            .map((plan) => ({ value: String(plan.record_id), label: plan.title || `Plan ${plan.record_id}` }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        periods,
        offices,
    };
}

/**
 * Applies the dashboard filters.
 *
 * Plan-level filters (plan, period, plan status, approval status) narrow the
 * plans first; objectives, inputs and mappings then follow the remaining
 * plans so every panel describes the same slice of work. The office filter
 * narrows objectives and inputs to that responsible unit.
 */
export function applyFilters(data, filters = emptyFilters) {
    const plans = (data.plans || []).filter((plan) => (!filters.plan || String(plan.record_id) === String(filters.plan))
        && (!filters.period || planPeriod(plan) === String(filters.period))
        && (!filters.planStatus || plan.status === filters.planStatus)
        && (!filters.approvalStatus || approvalStatusOf(plan) === filters.approvalStatus));
    const planIds = new Set(plans.map((plan) => String(plan.record_id)));

    const objectives = (data.objectives || []).filter((objective) => planIds.has(String(objective.strategic_plan_id))
        && (!filters.objectiveStatus || objective.status === filters.objectiveStatus)
        && (!filters.office || unitOf(objective) === filters.office));
    const objectiveIds = new Set(objectives.map((objective) => String(objective.objective_id)));

    const inputs = (data.inputs || []).filter((input) => planIds.has(String(input.plan_id))
        && (!filters.office || String(input.office || '').trim() === filters.office));

    const mappings = (data.mappings || []).filter((mapping) => planIds.has(String(mapping.plan_id)));
    const progressUpdates = (data.progressUpdates || []).filter((update) => objectiveIds.has(String(update.objective_id)));

    return { plans, objectives, inputs, mappings, progressUpdates };
}

export function summarisePlans(plans = []) {
    const byStatus = { draft: 0, finished: 0, archived: 0 };
    const byApproval = Object.fromEntries(Object.keys(APPROVAL_LABELS).map((key) => [key, 0]));

    plans.forEach((plan) => {
        if (plan.status in byStatus) byStatus[plan.status] += 1;
        const approval = approvalStatusOf(plan);
        byApproval[approval] = (byApproval[approval] || 0) + 1;
    });

    return { total: plans.length, byStatus, byApproval };
}

export function summariseObjectives(objectives = [], progressUpdates = []) {
    const latest = latestProgressByObjective(progressUpdates);
    const byStatus = { draft: 0, published: 0, archived: 0 };
    const byProgress = Object.fromEntries(Object.keys(PROGRESS_STATUS_LABELS).map((key) => [key, 0]));
    let progressTotal = 0;
    let reported = 0;

    objectives.forEach((objective) => {
        if (objective.status in byStatus) byStatus[objective.status] += 1;
        const update = latest.get(String(objective.objective_id));
        const progressStatus = update?.progress_status || 'not_started';
        byProgress[progressStatus] = (byProgress[progressStatus] || 0) + 1;
        const value = clampPercent(update?.progress);
        if (value !== null) {
            progressTotal += value;
            reported += 1;
        }
    });

    return {
        total: objectives.length,
        byStatus,
        byProgress,
        reported,
        averageProgress: reported ? Math.round(progressTotal / reported) : 0,
    };
}

export function summariseAlignment(objectives = [], mappings = []) {
    const aligned = alignedObjectiveIds(mappings);
    const active = objectives.filter((objective) => objective.status !== 'archived');
    const alignedCount = active.filter((objective) => aligned.has(String(objective.objective_id))).length;

    return {
        total: active.length,
        aligned: alignedCount,
        unaligned: active.length - alignedCount,
        coverage: percent(alignedCount, active.length),
    };
}

export function summariseUnits(objectives = [], progressUpdates = []) {
    const latest = latestProgressByObjective(progressUpdates);
    const units = new Map();

    objectives.forEach((objective) => {
        const name = unitOf(objective);
        const unit = units.get(name) || { name, objectives: 0, completed: 0, blocked: 0, reported: 0, progressTotal: 0 };
        const update = latest.get(String(objective.objective_id));
        const value = clampPercent(update?.progress);

        unit.objectives += 1;
        if (update?.progress_status === 'completed') unit.completed += 1;
        if (update?.progress_status === 'blocked') unit.blocked += 1;
        if (value !== null) {
            unit.reported += 1;
            unit.progressTotal += value;
        }
        units.set(name, unit);
    });

    return [...units.values()]
        .map(({ progressTotal, ...unit }) => ({
            ...unit,
            averageProgress: unit.reported ? Math.round(progressTotal / unit.reported) : 0,
            completionRate: percent(unit.completed, unit.objectives),
        }))
        .sort((a, b) => (a.name === UNASSIGNED_UNIT) - (b.name === UNASSIGNED_UNIT)
            || b.averageProgress - a.averageProgress
            || a.name.localeCompare(b.name));
}

export function summariseInputs(inputs = []) {
    const byStatus = Object.fromEntries(Object.keys(INPUT_STATUS_LABELS).map((key) => [key, 0]));
    inputs.forEach((input) => { byStatus[input.status] = (byStatus[input.status] || 0) + 1; });

    const reviewed = inputs.length - byStatus.pending;
    const consolidated = byStatus.accepted + byStatus.merged;

    return {
        total: inputs.length,
        byStatus,
        reviewed,
        consolidated,
        reviewRate: percent(reviewed, inputs.length),
        consolidationRate: percent(consolidated, inputs.length),
    };
}

/** Plans currently waiting at an approval stage, oldest submission first. */
export function awaitingApproval(plans = [], now = Date.now()) {
    return plans
        .filter((plan) => approvalStatusOf(plan) === 'under_approval')
        .map((plan) => {
            const submission = plan.approval_submission || {};
            return {
                plan,
                stage: submission.currentStage || plan.approval_stage || null,
                submittedAt: submission.submittedAt || null,
                waitingDays: daysSince(submission.submittedAt, now),
                totalStages: submission.workflowSnapshot?.stages?.length || null,
            };
        })
        .sort((a, b) => (toTime(a.submittedAt) ?? 0) - (toTime(b.submittedAt) ?? 0));
}

/** Plans with a completed approval decision, most recent first. */
export function decidedPlans(plans = []) {
    return plans
        .filter((plan) => ['approved', 'returned', 'rejected'].includes(approvalStatusOf(plan)))
        .map((plan) => {
            const history = plan.approval_submission?.history || [];
            const decision = [...history].reverse().find((event) => !['submitted', 'resubmitted'].includes(event.action)) || null;
            return { plan, status: approvalStatusOf(plan), decidedAt: decision?.occurredAt || null, note: decision?.comment || decision?.note || '', stageName: decision?.stageName || '' };
        })
        .sort((a, b) => (toTime(b.decidedAt) ?? 0) - (toTime(a.decidedAt) ?? 0));
}

/**
 * Planning items that need management attention.
 *
 * There are no due dates in the planning records yet, so "overdue" is judged
 * by how long an item has waited (see RISK_THRESHOLDS) and "at risk" by
 * reported progress.
 */
export function riskItems({ plans = [], objectives = [], inputs = [], progressUpdates = [] }, now = Date.now()) {
    const items = [];
    const latest = latestProgressByObjective(progressUpdates);
    const planTitles = new Map(plans.map((plan) => [String(plan.record_id), plan.title || `Plan ${plan.record_id}`]));

    awaitingApproval(plans, now).forEach(({ plan, stage, waitingDays }) => {
        if (waitingDays !== null && waitingDays >= RISK_THRESHOLDS.approvalOverdueDays) {
            items.push({
                id: `approval-${plan.record_id}`,
                severity: 'overdue',
                category: 'Approval',
                title: plan.title || `Plan ${plan.record_id}`,
                detail: `Waiting ${waitingDays} days at ${stage?.name || 'the current approval stage'}.`,
                href: `/strategic-plans/${plan.record_id}/finalize`,
            });
        }
    });

    inputs.forEach((input) => {
        const waitingDays = daysSince(input.created_at, now);
        if (input.status === 'pending' && waitingDays !== null && waitingDays >= RISK_THRESHOLDS.inputReviewOverdueDays) {
            items.push({
                id: `input-${input.id}`,
                severity: 'overdue',
                category: 'Input review',
                title: `${input.office || 'Office / Agency'} input`,
                detail: `Pending review for ${waitingDays} days on ${input.plan?.title || planTitles.get(String(input.plan_id)) || 'a plan'}.`,
                href: '/consolidate-inputs',
            });
        }
    });

    objectives
        .filter((objective) => objective.status !== 'archived')
        .forEach((objective) => {
            const update = latest.get(String(objective.objective_id));
            const title = objective.objective_title || `Objective ${objective.objective_id}`;
            const plan = planTitles.get(String(objective.strategic_plan_id)) || 'its plan';

            if (update?.progress_status === 'blocked') {
                items.push({
                    id: `blocked-${objective.objective_id}`,
                    severity: 'at_risk',
                    category: 'Objective',
                    title,
                    detail: `${unitOf(objective)} reported this objective as blocked (${plan}).`,
                    href: `/strategic-objectives?plan_id=${objective.strategic_plan_id}`,
                });
                return;
            }

            const staleDays = daysSince(update?.created_at, now);
            if (update && update.progress_status !== 'completed' && staleDays !== null && staleDays >= RISK_THRESHOLDS.progressStaleDays) {
                items.push({
                    id: `stale-${objective.objective_id}`,
                    severity: 'at_risk',
                    category: 'Objective',
                    title,
                    detail: `No progress update from ${unitOf(objective)} in ${staleDays} days (${plan}).`,
                    href: `/strategic-objectives?plan_id=${objective.strategic_plan_id}`,
                });
            }
        });

    const order = { overdue: 0, at_risk: 1 };
    return items.sort((a, b) => order[a.severity] - order[b.severity] || a.title.localeCompare(b.title));
}

export function buildDashboard(data, filters = emptyFilters, now = Date.now()) {
    const scoped = applyFilters(data, filters);

    return {
        scoped,
        plans: summarisePlans(scoped.plans),
        objectives: summariseObjectives(scoped.objectives, scoped.progressUpdates),
        alignment: summariseAlignment(scoped.objectives, scoped.mappings),
        units: summariseUnits(scoped.objectives, scoped.progressUpdates),
        inputs: summariseInputs(scoped.inputs),
        awaiting: awaitingApproval(scoped.plans, now),
        decided: decidedPlans(scoped.plans),
        risks: riskItems(scoped, now),
    };
}

export function hasActiveFilters(filters = emptyFilters) {
    return Object.values(filters).some((value) => value !== '' && value != null);
}
