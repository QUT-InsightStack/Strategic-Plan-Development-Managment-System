import { apiRequest } from './api-client.js';

const baseUrl = '/api/strategic-objectives';

export function listStrategicObjectives(planId) { return apiRequest(`/api/strategic-plans/${planId}/objectives`); }
export function listAllStrategicObjectives(params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
    return apiRequest(`${baseUrl}?${query.toString()}`);
}
export function createStrategicObjective(data) { return apiRequest(baseUrl, { method: 'POST', body: JSON.stringify(data) }); }
export function updateStrategicObjective(id, data) { return apiRequest(`${baseUrl}/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export function updateStrategicObjectiveStatus(id, status) {
    return apiRequest(`${baseUrl}/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}
export function deleteStrategicObjective(id) { return apiRequest(`${baseUrl}/${id}`, { method: 'DELETE' }); }
