import { apiRequest } from './api-client.js';

const baseUrl = '/api/strategic-plans';

export function listStrategicPlans(params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
    return apiRequest(`${baseUrl}?${query.toString()}`);
}
export function getStrategicPlan(id) { return apiRequest(`${baseUrl}/${id}`); }
export function createStrategicPlan(data) { return apiRequest(baseUrl, { method: 'POST', body: JSON.stringify(data) }); }
export function updateStrategicPlan(id, data) { return apiRequest(`${baseUrl}/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export function deleteStrategicPlan(id) { return apiRequest(`${baseUrl}/${id}`, { method: 'DELETE' }); }
export function copyStrategicPlan(id) { return apiRequest(`${baseUrl}/${id}/copy`, { method: 'POST' }); }
export function updateStrategicPlanStatus(id, status) { return apiRequest(`${baseUrl}/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
export function getStrategicPlanCoreValues(planId) { return apiRequest(`/api/strategic-records/${planId}/core-values`);}