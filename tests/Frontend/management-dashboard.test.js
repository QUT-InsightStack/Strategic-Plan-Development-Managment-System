import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    applyFilters,
    buildDashboard,
    emptyFilters,
    filterOptions,
    summariseAlignment,
    summariseInputs,
    summariseObjectives,
    summarisePlans,
    summariseUnits,
} from '../../resources/js/data/management-dashboard-data.js';
import { isManagementSession, managementLevel } from '../../resources/js/access/management-access.js';

const NOW = new Date('2026-09-30T00:00:00Z').getTime();
const daysAgo = (days) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

function fixture() {
    return {
        plans: [
            { record_id: 1, title: 'Science Plan', status: 'finished', created_at: '2026-02-01T00:00:00Z', approval_status: 'under_approval',
                approval_submission: { submittedAt: daysAgo(20), currentStage: { sequence: 2, name: 'Final Approval', approverType: 'role', approver: 'Management / Executive', status: 'pending' }, workflowSnapshot: { stages: [{}, {}] }, history: [] } },
            { record_id: 2, title: 'Innovation Plan', status: 'finished', created_at: '2025-03-01T00:00:00Z', approval_status: 'returned',
                approval_submission: { history: [{ action: 'submitted', occurredAt: daysAgo(10) }, { action: 'returned', stageName: 'Planning Review', note: 'Add targets', occurredAt: daysAgo(3) }] } },
            { record_id: 3, title: 'Draft Plan', status: 'draft', created_at: '2026-05-01T00:00:00Z' },
        ],
        objectives: [
            { objective_id: 10, strategic_plan_id: 1, status: 'published', responsible_office_agency: 'Office 1', objective_title: 'Grow R&D' },
            { objective_id: 11, strategic_plan_id: 1, status: 'published', responsible_office_agency: 'Office 2', objective_title: 'Adopt tech' },
            { objective_id: 12, strategic_plan_id: 2, status: 'draft', responsible_office_agency: '', objective_title: 'Partner' },
            { objective_id: 13, strategic_plan_id: 3, status: 'archived', responsible_office_agency: 'Office 1', objective_title: 'Old' },
        ],
        progressUpdates: [
            { kind: 'progress', objective_id: 10, progress: 40, progress_status: 'in_progress', created_at: daysAgo(40) },
            { kind: 'progress', objective_id: 10, progress: 80, progress_status: 'in_progress', created_at: daysAgo(2) },
            { kind: 'progress', objective_id: 11, progress: 20, progress_status: 'blocked', created_at: daysAgo(1) },
        ],
        inputs: [
            { id: 1, plan_id: 1, office: 'Office 1', status: 'pending', created_at: daysAgo(9) },
            { id: 2, plan_id: 1, office: 'Office 2', status: 'merged', created_at: daysAgo(2) },
            { id: 3, plan_id: 2, office: 'Office 1', status: 'accepted', created_at: daysAgo(2) },
        ],
        mappings: [
            { plan_id: 1, dost_objective_id: 10, status: 'active' },
            { plan_id: 2, agency_objective_id: 12, status: 'active' },
        ],
    };
}

test('plan summary counts planning and approval statuses', () => {
    const summary = summarisePlans(fixture().plans);
    assert.equal(summary.total, 3);
    assert.deepEqual(summary.byStatus, { draft: 1, finished: 2, archived: 0 });
    assert.equal(summary.byApproval.under_approval, 1);
    assert.equal(summary.byApproval.returned, 1);
    assert.equal(summary.byApproval.not_submitted, 1);
});

test('objective progress uses only the latest update per objective', () => {
    const { objectives, progressUpdates } = fixture();
    const summary = summariseObjectives(objectives, progressUpdates);
    assert.equal(summary.reported, 2);
    assert.equal(summary.averageProgress, 50);
    assert.equal(summary.byProgress.blocked, 1);
    assert.equal(summary.byProgress.not_started, 2);
});

test('alignment coverage ignores archived objectives', () => {
    const { objectives, mappings } = fixture();
    assert.deepEqual(summariseAlignment(objectives, mappings), { total: 3, aligned: 2, unaligned: 1, coverage: 67 });
});

test('unit performance groups objectives and keeps Unassigned last', () => {
    const { objectives, progressUpdates } = fixture();
    const units = summariseUnits(objectives, progressUpdates);
    assert.deepEqual(units.map((unit) => unit.name), ['Office 1', 'Office 2', 'Unassigned']);
    assert.equal(units[1].blocked, 1);
});

test('input summary reports review and consolidation rates', () => {
    const summary = summariseInputs(fixture().inputs);
    assert.equal(summary.reviewRate, 67);
    assert.equal(summary.consolidationRate, 67);
});

test('filters narrow every dataset to the same plans and office', () => {
    const scoped = applyFilters(fixture(), { ...emptyFilters, period: '2026', office: 'Office 1' });
    assert.deepEqual(scoped.plans.map((plan) => plan.record_id), [1, 3]);
    assert.deepEqual(scoped.objectives.map((objective) => objective.objective_id), [10, 13]);
    assert.deepEqual(scoped.inputs.map((input) => input.id), [1]);
});

test('filter options come from visible records', () => {
    const options = filterOptions(fixture());
    assert.deepEqual(options.periods, ['2026', '2025']);
    assert.equal(options.offices.at(-1), 'Unassigned');
});

test('dashboard flags overdue approvals, overdue input reviews and blocked objectives', () => {
    const dashboard = buildDashboard(fixture(), emptyFilters, NOW);
    const ids = dashboard.risks.map((item) => item.id);
    assert.ok(ids.includes('approval-1'));
    assert.ok(ids.includes('input-1'));
    assert.ok(ids.includes('blocked-11'));
    assert.equal(dashboard.risks[0].severity, 'overdue');
    assert.equal(dashboard.decided[0].note, 'Add targets');
});

test('building the dashboard does not modify the loaded records', () => {
    const data = fixture();
    const before = JSON.stringify(data);
    buildDashboard(data, { ...emptyFilters, office: 'Office 2' }, NOW);
    assert.equal(JSON.stringify(data), before);
});

test('only management levels can open the dashboard', () => {
    const management = { roleName: 'Management / Executive', permissions: ['dashboard.view'] };
    const technical = { roleName: 'Technical Administrator', permissions: ['dashboard.view', 'backups.view'] };
    const configured = { roleName: 'Regional Director', permissions: ['dashboard.view', 'management_dashboard.view'] };

    assert.equal(managementLevel(management), 'Executive');
    assert.equal(isManagementSession(management), true);
    assert.equal(isManagementSession(technical), false);
    assert.equal(isManagementSession(configured), true);
    assert.equal(isManagementSession({ roleName: 'Management', permissions: [] }), false);
});
