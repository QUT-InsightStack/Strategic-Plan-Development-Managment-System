const ROLE_DISPLAY_NAMES = Object.freeze({
    test: 'test',
    'Technical Administrator': 'Technical Admin',
    'Technical Admin': 'Technical Admin',
    'Administrative Administrator': 'Administrative Admin',
    'Administrative Admin': 'Administrative Admin',
    'Planner/Encoder': 'Planning Officer',
    'Planning Officer': 'Planning Officer',
    'Office Representative': 'Office/Agency',
    'Offices / Agencies': 'Office/Agency',
    'Office/Agency': 'Office/Agency',
    'Responsible Unit User': 'Office/Agency',
    'Division Head': 'Management',
    Management: 'Management',
    Viewer: 'Office',
    Office: 'Office',
    Executive: 'Management / Executive',
    'Management / Executive': 'Management / Executive',
});

export function displayRoleName(roleName, fallback = 'Unassigned') {
    const normalizedRoleName = String(roleName ?? '').trim();

    if (!normalizedRoleName) return fallback;

    return ROLE_DISPLAY_NAMES[normalizedRoleName] || normalizedRoleName;
}

// Administrator is a separate legacy full-access role, not Administrative Admin.
export function adminRoleKind(roleName) {
    if (roleName === 'test') return 'technical';
    const label = displayRoleName(roleName, '');
    if (label === 'Administrative Admin') return 'administrative';
    if (label === 'Technical Admin') return 'technical';
    return null;
}
