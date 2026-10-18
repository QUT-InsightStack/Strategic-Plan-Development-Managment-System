const ASSIGNMENTS_KEY = 'spdms.frontend-objective-assignments';
const OFFICES_KEY = 'spdms.frontend-office-catalog';
const FALLBACK_UNITS = ['Office 1', 'Office 2', 'Office 3', 'Agency 1', 'Agency 2'];

function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
}

function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase();
}

export function rememberOfficeSession(session) {
    const officeRoles = ['Office Representative', 'Office/Agency', 'Offices / Agencies', 'Responsible Unit User'];
    const office = String(session?.office || '').trim();
    if (!office || !officeRoles.includes(session?.roleName)) return;
    const offices = read(OFFICES_KEY, []);
    if (!offices.some(item => normalize(item) === normalize(office))) {
        localStorage.setItem(OFFICES_KEY, JSON.stringify([...offices, office].sort()));
    }
}

export function getAssignableUnits(objectives = [], additionalUnits = []) {
    const existing = objectives.map(item => item.responsible_office_agency);
    return [...new Set([...read(OFFICES_KEY, []), ...existing, ...additionalUnits, ...FALLBACK_UNITS].map(item => String(item || '').trim()).filter(Boolean))].sort();
}

export function assignObjectiveLocally(objective, office, session = {}) {
    const assignments = read(ASSIGNMENTS_KEY, {});
    assignments[String(objective.objective_id)] = {
        objective_id: Number(objective.objective_id),
        strategic_plan_id: Number(objective.strategic_plan_id),
        office: String(office).trim(),
        assigned_by: session.userId || null,
        assigned_at: new Date().toISOString(),
    };
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
    window.dispatchEvent(new CustomEvent('spdms:objective-assignments-changed'));
    return { ...objective, responsible_office_agency: assignments[String(objective.objective_id)].office };
}

export function applyLocalObjectiveAssignments(objectives = []) {
    const assignments = read(ASSIGNMENTS_KEY, {});
    return objectives.map(objective => {
        const assignment = assignments[String(objective.objective_id)];
        return assignment ? { ...objective, responsible_office_agency: assignment.office, frontend_assignment: assignment } : objective;
    });
}

export function objectivesAssignedToOffice(objectives = [], office = '') {
    const officeName = normalize(office);
    if (!officeName) return [];
    return objectives.filter(objective => {
        // The API's authoritative assignment is the related ResponsibleUnit.
        // Keep the legacy text field as a fallback for older responses.
        const assignedOffice = objective.responsible_unit_assignment?.responsible_unit?.responsible_office_agency
            || objective.responsible_office_agency;
        return normalize(assignedOffice) === officeName;
    });
}
