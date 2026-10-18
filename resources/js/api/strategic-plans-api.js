import { apiRequest } from './api-client.js';

const baseUrl = '/api/strategic-plans';

export function listStrategicPlans(params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
    return apiRequest(`${baseUrl}?${query.toString()}`);
}
export function getStrategicPlan(id, params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
    return apiRequest(`${baseUrl}/${id}${query.size ? `?${query}` : ''}`);
}
export function listStrategicPlanComments(id, params = {}) { return apiRequest(`${baseUrl}/${id}/comments?${new URLSearchParams(params)}`); }
export function addStrategicPlanComment(id, content) {
    return apiRequest(`${baseUrl}/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
}
export function createStrategicPlan(data) { return apiRequest(baseUrl, { method: 'POST', body: JSON.stringify(data) }); }
export function updateStrategicPlan(id, data) { return apiRequest(`${baseUrl}/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export function deleteStrategicPlan(id) { return apiRequest(`${baseUrl}/${id}`, { method: 'DELETE' }); }
export function copyStrategicPlan(id) { return apiRequest(`${baseUrl}/${id}/copy`, { method: 'POST' }); }
export function updateStrategicPlanStatus(id, status) { return apiRequest(`${baseUrl}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
export function getStrategicPlanCoreValues(planId) { return apiRequest(`/api/strategic-records/${planId}/core-values`);}

// Upload selectors must not mistake the first page of plans for the full draft list.
export async function listUploadPlans() {
    const plans = [];
    let page = 1;
    let lastPage = 1;
    do {
        const result = await listStrategicPlans({ status: 'draft', per_page: 100, page });
        plans.push(...(result.data || []));
        lastPage = result.meta?.last_page || 1;
        page++;
    } while (page <= lastPage);
    return { data: plans, meta: { total: plans.length, current_page: 1, last_page: 1 } };
}
