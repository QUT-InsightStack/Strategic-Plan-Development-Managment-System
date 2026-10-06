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

export function planningYears(plans) {
    const years = new Set();
    plans.forEach(plan => {
        const start = Number(String(plan.planning_start_date || '').slice(0, 4));
        const end = Number(String(plan.planning_end_date || '').slice(0, 4));
        if (!Number.isInteger(start) || start < 1900 || !Number.isInteger(end) || end < start) return;
        for (let year = start; year <= Math.min(end, start + 30); year += 1) years.add(year);
    });
    return [...years].sort((a, b) => a - b);
}

export function filterManagementRows(plans, objectives, filters, inputs = []) {
    const selectedPlans = plans.filter(plan =>
        (!filters.planId || String(plan.record_id) === String(filters.planId))
        && (!filters.year || (Number(String(plan.planning_start_date || '').slice(0, 4)) <= Number(filters.year)
            && Number(String(plan.planning_end_date || '').slice(0, 4)) >= Number(filters.year)))
        && (!filters.planStatus || plan.status === filters.planStatus)
        && (!filters.approvalStatus || plan.approval_status === filters.approvalStatus));
    const selectedIds = new Set(selectedPlans.map(plan => String(plan.record_id)));
    const selectedObjectives = objectives.filter(objective => selectedIds.has(String(objective.strategic_plan_id))
        && (!filters.office || officeName(objective) === filters.office)
        && (!filters.objectiveStatus || progressStatus(objective) === filters.objectiveStatus));
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
    return end.getTime() - now.getTime() <= 30 * 86400000 && progressPercent(objective) < 75 ? 'At risk' : '';
}

export function officePerformance(objectives) {
    const groups = new Map();
    objectives.forEach(objective => {
        const name = officeName(objective);
        const row = groups.get(name) || { office: name, objectives: 0, completed: 0, progressTotal: 0 };
        row.objectives += 1;
        row.completed += progressStatus(objective) === 'completed' ? 1 : 0;
        row.progressTotal += progressPercent(objective);
        groups.set(name, row);
    });
    return [...groups.values()].map(row => ({
        office: row.office, objectives: row.objectives, completed: row.completed,
        average_progress_percent: Math.round(row.progressTotal / row.objectives),
    })).sort((a, b) => a.office.localeCompare(b.office));
}
