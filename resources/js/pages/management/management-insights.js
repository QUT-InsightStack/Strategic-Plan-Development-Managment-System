export function progressPercent(objective) {
    return Math.max(0, Math.min(100, Number(objective.progress_percentage) || 0));
}

export function progressStatus(objective) {
    const value = objective.progress_status;
    return ['completed', 'in_progress', 'not_started'].includes(value)
        ? value : progressPercent(objective) >= 100 ? 'completed' : progressPercent(objective) > 0 ? 'in_progress' : 'not_started';
}

export function officeName(objective) {
    return objective.responsible_unit_assignment?.responsible_unit?.responsible_office_agency
        || objective.responsible_office_agency || 'Unassigned';
}

export function planYearRange(plan) {
    const start = Number(String(plan?.planning_start_date || '').slice(0, 4));
    const end = Number(String(plan?.planning_end_date || '').slice(0, 4));
    if (!Number.isInteger(start) || start < 1900 || !Number.isInteger(end) || end < start) return null;
    return { start, end };
}

export function planPeriodKey(plan) {
    const range = planYearRange(plan);
    return range ? `${range.start}-${range.end}` : '';
}

export function periodLabel(key) {
    return String(key || '').replace('-', '–');
}

// Planning periods are the distinct start–end year pairs of the plans the API returned.
export function planningPeriods(plans) {
    const periods = new Map();
    plans.forEach(plan => {
        const range = planYearRange(plan);
        if (range) periods.set(`${range.start}-${range.end}`, range);
    });
    return [...periods.entries()].map(([value, range]) => ({ value, label: periodLabel(value), ...range }))
        .sort((a, b) => a.start - b.start || a.end - b.end);
}

// The six-year chart needs one period: the chosen one, the selected plan's, or the earliest in scope.
export function chartPeriod(plans, filters = {}) {
    if (filters.period) return { value: filters.period, defaulted: false };
    const plan = filters.planId && plans.find(item => String(item.record_id) === String(filters.planId));
    if (plan && planPeriodKey(plan)) return { value: planPeriodKey(plan), defaulted: false };
    const earliest = planningPeriods(plans)[0];
    return earliest ? { value: earliest.value, defaulted: true } : { value: '', defaulted: false };
}

// The shared status filter holds either a plan lifecycle status ("plan:…") or an objective progress status ("objective:…").
export function scopeFilters(filters) {
    const [kind, value] = String(filters.status || '').split(':');
    return {
        planId: filters.planId || '', period: filters.period || '', office: filters.office || '',
        planStatus: kind === 'plan' ? value || '' : '', objectiveStatus: kind === 'objective' ? value || '' : '',
        approvalStatus: filters.approvalStatus || '',
    };
}

export function planMatchesFilters(plan, filters) {
    return (!filters.planId || String(plan.record_id) === String(filters.planId))
        && (!filters.period || planPeriodKey(plan) === filters.period)
        && (!filters.planStatus || plan.status === filters.planStatus)
        && (!filters.approvalStatus || (plan.approval_status || 'not_submitted') === filters.approvalStatus);
}

export function filterManagementRows(plans, objectives, filters, inputs = []) {
    const selectedPlans = plans.filter(plan => planMatchesFilters(plan, filters));
    const selectedIds = new Set(selectedPlans.map(plan => String(plan.record_id)));
    const selectedObjectives = objectives.filter(objective => selectedIds.has(String(objective.strategic_plan_id))
        && (!filters.office || officeName(objective) === filters.office)
        && (!filters.objectiveStatus || (filters.objectiveStatus === 'overdue'
            ? objectiveRisk(objective, selectedPlans.find(plan => String(plan.record_id) === String(objective.strategic_plan_id))) === 'Overdue'
            : progressStatus(objective) === filters.objectiveStatus)));
    const visibleIds = filters.office || filters.objectiveStatus
        ? new Set(selectedObjectives.map(objective => String(objective.strategic_plan_id))) : selectedIds;
    if (filters.office && !filters.objectiveStatus) {
        selectedPlans.filter(plan => plan.department_agency === filters.office).forEach(plan => visibleIds.add(String(plan.record_id)));
        inputs.filter(input => input.responsible_office_agency === filters.office && selectedIds.has(String(input.strategic_plan_id)))
            .forEach(input => visibleIds.add(String(input.strategic_plan_id)));
    }
    return { plans: selectedPlans.filter(plan => visibleIds.has(String(plan.record_id))), objectives: selectedObjectives };
}

export function objectiveRisk(objective, plan, now = new Date()) {
    if (progressStatus(objective) === 'completed' || !plan?.planning_end_date) return '';
    const end = new Date(`${String(plan.planning_end_date).slice(0, 10)}T23:59:59`);
    if (Number.isNaN(end.getTime())) return '';
    if (end < now) return 'Overdue';
    return ''; // No client-approved at-risk threshold has been defined.
}

export function officePerformance(objectives) {
    const groups = new Map();
    objectives.forEach(objective => {
        const name = officeName(objective);
        const row = groups.get(name) || { office: name, objectives: 0, completed: 0, in_progress: 0, not_started: 0 };
        row.objectives += 1;
        row.completed += progressStatus(objective) === 'completed' ? 1 : 0;
        if (progressStatus(objective) !== 'completed') row[progressStatus(objective)] += 1;
        groups.set(name, row);
    });
    return [...groups.values()].map(row => ({
        office: row.office, objectives: row.objectives, completed: row.completed,
        in_progress: row.in_progress, not_started: row.not_started,
    })).sort((a, b) => a.office.localeCompare(b.office));
}

export function isAligned(objective) {
    return Boolean((objective.presidential_agenda_items || []).length && (objective.pdp_chapters || []).length);
}

// Per Office/Unit: objectives, completion, Agenda + PDP coverage, agency inputs and overdue items.
export function officeUnitPerformance(objectives, { plansById = new Map(), inputs = [], now = new Date() } = {}) {
    const groups = new Map();
    const rowFor = name => groups.get(name) || { office: name, objectives: 0, completed: 0, aligned: 0, inputs_submitted: 0, inputs_pending: 0, overdue: 0 };
    objectives.forEach(objective => {
        const row = rowFor(officeName(objective));
        row.objectives += 1;
        if (progressStatus(objective) === 'completed') row.completed += 1;
        if (isAligned(objective)) row.aligned += 1;
        if (objectiveRisk(objective, plansById.get(String(objective.strategic_plan_id)), now) === 'Overdue') row.overdue += 1;
        groups.set(row.office, row);
    });
    inputs.forEach(input => {
        const row = rowFor(input.responsible_office_agency || 'Unassigned');
        row.inputs_submitted += 1;
        if (input.review_status === 'Pending Review') row.inputs_pending += 1;
        groups.set(row.office, row);
    });
    const percent = (part, total) => total ? Math.round(part * 100 / total) : 0;
    return [...groups.values()].map(row => ({
        office: row.office, objectives: row.objectives, completed: row.completed,
        completion_percent: percent(row.completed, row.objectives),
        alignment_percent: percent(row.aligned, row.objectives),
        inputs_submitted: row.inputs_submitted, inputs_pending: row.inputs_pending, overdue: row.overdue,
    })).sort((a, b) => a.office.localeCompare(b.office));
}

function timestamp(value) {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
}

// Objective status at the end of each plan year (Year 1 = period start year), rebuilt from progress history.
// Delayed applies the existing overdue rule at that date. Future years carry no counts.
export function sixYearProgress({ period, objectives, updates = [], plansById = new Map(), now = new Date() }) {
    const [start, end] = String(period || '').split('-').map(Number);
    if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) return { years: [], truncated: false };
    const history = new Map();
    [...updates].sort((a, b) => (timestamp(a.created_at) ?? 0) - (timestamp(b.created_at) ?? 0)).forEach(update => {
        const key = String(update.objective_id);
        history.set(key, [...(history.get(key) || []), update]);
    });
    const years = Array.from({ length: Math.min(6, end - start + 1) }, (_, index) => {
        const year = start + index;
        const row = { label: `Year ${index + 1}`, year, future: new Date(year, 0, 1) > now, completed: 0, ongoing: 0, not_started: 0, delayed: 0, total: 0 };
        if (row.future) return row;
        const asOf = Math.min(new Date(year, 11, 31, 23, 59, 59).getTime(), now.getTime());
        objectives.forEach(objective => {
            const created = timestamp(objective.created_at);
            if (created !== null && created > asOf) return;
            const entries = history.get(String(objective.objective_id)) || [];
            const known = entries.filter(entry => (timestamp(entry.created_at) ?? 0) <= asOf).pop();
            // Without any history the current value is the only record; it counts once it was last updated.
            const updatedAt = timestamp(objective.progress_updated_at);
            const percentage = known ? Number(known.new_percentage) || 0
                : !entries.length && (updatedAt === null || updatedAt <= asOf) ? progressPercent(objective) : 0;
            const snapshot = { progress_percentage: percentage };
            const state = objectiveRisk(snapshot, plansById.get(String(objective.strategic_plan_id)), new Date(asOf)) === 'Overdue' ? 'delayed'
                : { completed: 'completed', in_progress: 'ongoing', not_started: 'not_started' }[progressStatus(snapshot)];
            row[state] += 1;
            row.total += 1;
        });
        return row;
    });
    return { years, truncated: end - start + 1 > 6 };
}
