export function officeViewShowsAllPlans() {
    return false;
}

export function officePlanHref(id, view) {
    const params = new URLSearchParams({ plan: String(id) });
    if (view !== 'review') params.set('view', view);
    return `/office?${params}`;
}