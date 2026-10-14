import assert from 'node:assert/strict';
import test from 'node:test';
import {
    chartPeriod, filterManagementRows, officeUnitPerformance, planMatchesFilters, planningPeriods, scopeFilters, sixYearProgress,
} from '../../resources/js/pages/management/management-insights.js';
import { EMPTY_MANAGEMENT_FILTERS, hasManagementFilters, readManagementFilters, writeManagementFilters } from '../../resources/js/pages/management/management-filters.js';
import { approvalGroups, approvalSection, managementApprovalsRedirect, mergeAssignedPlans } from '../../resources/js/pages/management/management-approvals.js';

const plan = (id, start, end, extra = {}) => ({ record_id: id, title: `Plan ${id}`, planning_start_date: start, planning_end_date: end, status: 'finished', approval_status: 'approved', ...extra });
const objective = (id, planId, extra = {}) => ({ objective_id: id, strategic_plan_id: planId, objective_title: `Objective ${id}`, status: 'published', progress_percentage: 0, ...extra });

test('planning periods are the distinct start–end year pairs from the returned plans', () => {
    const periods = planningPeriods([
        plan(1, '2023-01-01', '2028-12-31'), plan(2, '2023-07-01', '2028-06-30'), plan(3, '2020-01-01', '2025-12-31'),
        plan(4, null, '2028-12-31'), plan(5, '2030-01-01', '2029-01-01'),
    ]);
    assert.deepEqual(periods.map(period => period.value), ['2020-2025', '2023-2028']);
    assert.equal(periods[1].label, '2023–2028');
});

test('the chart period is the selected period, the selected plan’s period, or the earliest one in scope', () => {
    const plans = [plan(1, '2023-01-01', '2028-12-31'), plan(2, '2020-01-01', '2025-12-31')];
    assert.deepEqual(chartPeriod(plans, { period: '2023-2028' }), { value: '2023-2028', defaulted: false });
    assert.deepEqual(chartPeriod(plans, { planId: '1' }), { value: '2023-2028', defaulted: false });
    assert.deepEqual(chartPeriod(plans, {}), { value: '2020-2025', defaulted: true });
    assert.deepEqual(chartPeriod([], {}), { value: '', defaulted: false });
});

test('shared filters split plan and objective status and match plans by period', () => {
    assert.deepEqual(scopeFilters({ status: 'plan:finished', approvalStatus: 'approved' }),
        { planId: '', period: '', office: '', planStatus: 'finished', objectiveStatus: '', approvalStatus: 'approved' });
    assert.equal(scopeFilters({ status: 'objective:overdue' }).objectiveStatus, 'overdue');
    assert.equal(planMatchesFilters(plan(1, '2023-01-01', '2028-12-31'), { period: '2023-2028' }), true);
    assert.equal(planMatchesFilters(plan(1, '2023-01-01', '2028-12-31'), { period: '2024-2029' }), false);
    assert.equal(planMatchesFilters(plan(2, '2023-01-01', '2028-12-31', { approval_status: null }), { approvalStatus: 'not_submitted' }), true);
    const rows = filterManagementRows([plan(1, '2023-01-01', '2028-12-31'), plan(2, '2020-01-01', '2025-12-31')], [objective(1, 1), objective(2, 2)], { period: '2020-2025' });
    assert.deepEqual(rows.plans.map(item => item.record_id), [2]);
    assert.deepEqual(rows.objectives.map(item => item.objective_id), [2]);
});

test('filters round-trip through URL parameters without touching other parameters', () => {
    const params = writeManagementFilters(new URLSearchParams('tab=alignment&plan=7'), { ...EMPTY_MANAGEMENT_FILTERS, planId: '3', period: '2023-2028', status: 'objective:completed' });
    assert.equal(params.get('tab'), 'alignment');
    assert.equal(params.get('plan'), '7', 'the Plan Review page keeps its own plan parameter');
    assert.deepEqual(readManagementFilters(params), { planId: '3', period: '2023-2028', office: '', status: 'objective:completed', approvalStatus: '' });
    assert.equal(hasManagementFilters(readManagementFilters('tab=inputs')), false);
    writeManagementFilters(params, EMPTY_MANAGEMENT_FILTERS);
    assert.equal(params.toString(), 'tab=alignment&plan=7');
});

test('six-year progress rebuilds status at each year end from progress history', () => {
    const plans = new Map([['1', plan(1, '2023-01-01', '2028-12-31')]]);
    const objectives = [
        objective(1, 1, { created_at: '2023-02-01T00:00:00Z', progress_percentage: 100 }),
        objective(2, 1, { created_at: '2023-03-01T00:00:00Z', progress_percentage: 40 }),
        objective(3, 1, { created_at: '2024-06-01T00:00:00Z', progress_percentage: 0 }),
    ];
    const updates = [
        { objective_id: 1, new_percentage: 30, created_at: '2023-05-01T00:00:00Z' },
        { objective_id: 1, new_percentage: 100, created_at: '2024-04-01T00:00:00Z' },
        { objective_id: 2, new_percentage: 40, created_at: '2024-08-01T00:00:00Z' },
    ];
    const { years, truncated } = sixYearProgress({ period: '2023-2028', objectives, updates, plansById: plans, now: new Date('2025-03-01T00:00:00Z') });
    assert.equal(truncated, false);
    assert.deepEqual(years.map(row => row.label), ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6']);
    assert.deepEqual(years.map(row => row.year), [2023, 2024, 2025, 2026, 2027, 2028]);
    assert.deepEqual(pick(years[0]), { completed: 0, ongoing: 1, not_started: 1, delayed: 0, total: 2 });
    assert.deepEqual(pick(years[1]), { completed: 1, ongoing: 1, not_started: 1, delayed: 0, total: 3 });
    assert.deepEqual(pick(years[2]), { completed: 1, ongoing: 1, not_started: 1, delayed: 0, total: 3 }, 'the current year is counted as of today');
    assert.ok(years.slice(3).every(row => row.future && row.total === 0), 'future years have no bar');
});

test('six-year progress marks incomplete objectives delayed after the plan end date', () => {
    const plans = new Map([['1', plan(1, '2020-01-01', '2021-12-31')]]);
    const objectives = [objective(1, 1, { created_at: '2020-01-05T00:00:00Z' }), objective(2, 1, { created_at: '2020-01-05T00:00:00Z' })];
    const updates = [{ objective_id: 2, new_percentage: 100, created_at: '2021-06-01T00:00:00Z' }];
    const { years } = sixYearProgress({ period: '2020-2021', objectives, updates, plansById: plans, now: new Date('2026-01-01T00:00:00Z') });
    assert.equal(years.length, 2, 'a shorter period shows only its own years');
    assert.deepEqual(pick(years[1]), { completed: 1, ongoing: 0, not_started: 1, delayed: 0, total: 2 }, 'not yet past the end date at the end of the final year');
    const later = sixYearProgress({ period: '2020-2027', objectives, updates, plansById: plans, now: new Date('2026-01-01T00:00:00Z') });
    assert.equal(later.truncated, true);
    assert.equal(later.years.length, 6);
    assert.deepEqual(pick(later.years[2]), { completed: 1, ongoing: 0, not_started: 0, delayed: 1, total: 2 });
});

test('objectives without history use their current progress once it was recorded', () => {
    const objectives = [objective(1, 1, { created_at: '2023-01-10T00:00:00Z', progress_percentage: 60, progress_updated_at: '2024-02-01T00:00:00Z' })];
    const { years } = sixYearProgress({ period: '2023-2028', objectives, plansById: new Map([['1', plan(1, '2023-01-01', '2028-12-31')]]), now: new Date('2024-12-31T12:00:00Z') });
    assert.equal(years[0].not_started, 1);
    assert.equal(years[1].ongoing, 1);
});

test('office performance aggregates completion, alignment, inputs and overdue items per unit', () => {
    const plans = new Map([['1', plan(1, '2020-01-01', '2021-12-31')], ['2', plan(2, '2023-01-01', '2099-12-31')]]);
    const aligned = { presidential_agenda_items: [{ title: 'Agenda' }], pdp_chapters: [{ title: 'Chapter' }] };
    const unit = name => ({ responsible_unit_assignment: { responsible_unit: { responsible_office_agency: name } }, responsible_office_agency: 'Legacy text' });
    const rows = officeUnitPerformance([
        objective(1, 1, { ...unit('ICT Office'), ...aligned, progress_percentage: 100 }),
        objective(2, 1, { ...unit('ICT Office'), progress_percentage: 20 }),
        objective(3, 2, { responsible_office_agency: 'Research Office', ...aligned, progress_percentage: 50 }),
    ], {
        plansById: plans, now: new Date('2026-01-01T00:00:00Z'),
        inputs: [{ responsible_office_agency: 'ICT Office', review_status: 'Pending Review' }, { responsible_office_agency: 'ICT Office', review_status: 'Approved' }, { responsible_office_agency: 'Finance Office', review_status: 'Pending Review' }],
    });
    assert.deepEqual(rows, [
        { office: 'Finance Office', objectives: 0, completed: 0, completion_percent: 0, alignment_percent: 0, inputs_submitted: 1, inputs_pending: 1, overdue: 0 },
        { office: 'ICT Office', objectives: 2, completed: 1, completion_percent: 50, alignment_percent: 50, inputs_submitted: 2, inputs_pending: 1, overdue: 1 },
        { office: 'Research Office', objectives: 1, completed: 0, completion_percent: 0, alignment_percent: 100, inputs_submitted: 0, inputs_pending: 0, overdue: 0 },
    ]);
});

test('approval lists group plans by existing approval status and keep assigned plans', () => {
    const plans = [plan(1, null, null, { approval_status: 'under_approval' }), plan(2, null, null, { approval_status: 'rejected' }), plan(3, null, null)];
    const merged = mergeAssignedPlans(plans, [{ planId: 1 }, { planId: 9, plan_snapshot: { title: 'Snapshot' } }]);
    const groups = approvalGroups(merged);
    assert.deepEqual(groups.pending.map(item => item.record_id), [1, 9]);
    assert.deepEqual(groups.returned.map(item => item.record_id), [2]);
    assert.deepEqual(groups.approved.map(item => item.record_id), [3]);
    assert.equal(approvalSection('returned'), 'returned');
    assert.equal(approvalSection('anything'), 'pending');
});

test('old approval links redirect Management to the Reviews & Approvals tab with filters', () => {
    assert.equal(managementApprovalsRedirect('http://localhost/management-approvals?status=returned&period=2023-2028'),
        '/management-dashboard?period=2023-2028&tab=approvals&queue=returned');
    assert.equal(managementApprovalsRedirect('http://localhost/management-approvals'), '/management-dashboard?tab=approvals&queue=pending');
});

function pick(row) {
    return { completed: row.completed, ongoing: row.ongoing, not_started: row.not_started, delayed: row.delayed, total: row.total };
}
