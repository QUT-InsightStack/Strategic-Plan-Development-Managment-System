import { listStrategicPlans } from '../../api/strategic-plans-api.js';
import { apiRequest } from '../../api/api-client.js';

export async function loadAllManagementPages(loader) {
    const rows = [];
    let page = 1;
    let lastPage = 1;
    do {
        const response = await loader({ page, per_page: 100 });
        rows.push(...(Array.isArray(response?.data) ? response.data : []));
        lastPage = Number(response?.meta?.last_page ?? response?.last_page ?? 1);
        page += 1;
    } while (page <= lastPage);
    return rows;
}

export function listAuthorizedManagementPlans() {
    return loadAllManagementPages(listStrategicPlans);
}

// Objectives and progress history for one plan, scoped by the backend like the objective listing.
export async function getManagementProgressTimeline(planId) {
    const response = await apiRequest(`/api/management/progress-timeline?plan_id=${encodeURIComponent(planId)}`);
    return response.data;
}

export function managementDateLabel(value, fallback = '—') {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}
