const allPlanViews = new Set(['review', 'comments', 'proposal']);

export function officeViewShowsAllPlans(view) {
    return allPlanViews.has(view);
}

export function officePlanHref(id, view) {
    const params = new URLSearchParams({ plan: String(id) });
    if (view !== 'review') params.set('view', view);
    if (officeViewShowsAllPlans(view)) params.set('include_all_office_plans', '1');
    return `/office?${params}`;
}
