import { apiRequest } from './api-client.js';

const baseUrl = '/api/strategic-objectives';

export function listStrategicObjectives(planId) { return apiRequest(`/api/strategic-plans/${planId}/objectives`); }
export function listAllStrategicObjectives(params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
    return apiRequest(`${baseUrl}?${query.toString()}`);
}
export function createStrategicObjective(data) { return apiRequest(baseUrl, { method: 'POST', body: JSON.stringify(data) }); }
export function updateStrategicObjective(id, data) { return apiRequest(`${baseUrl}/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
export function updateStrategicObjectiveAlignments(id, data) {
    return apiRequest(`${baseUrl}/${id}/alignments`, { method: 'PUT', body: JSON.stringify(data) });
}
export function updateStrategicObjectiveStatus(id, status) {
    return apiRequest(`${baseUrl}/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}
export function deleteStrategicObjective(id) { return apiRequest(`${baseUrl}/${id}`, { method: 'DELETE' }); }

export function assignResponsibleUnit(id, responsibleOfficeAgency) {
    return apiRequest(`${baseUrl}/${id}/responsible-unit`, {
        method: 'PUT', body: JSON.stringify({ responsible_office_agency: responsibleOfficeAgency }),
    });
}

export function assignResponsibleUnitToObjectives(objectiveIds, responsibleUnitId) {
    return apiRequest(`${baseUrl}/responsible-unit`, {
        method: 'PUT', body: JSON.stringify({ objective_ids: objectiveIds, responsible_unit_id: responsibleUnitId }),
    });
}

export function listResponsibleUnits(params = {}) {
    return apiRequest(`/api/responsible-units?${new URLSearchParams(params)}`);
}

export function listObjectiveComments(id, params = {}) {
    return apiRequest(`${baseUrl}/${id}/comments?${new URLSearchParams(params)}`);
}

export function addObjectiveComment(id, content) {
    return apiRequest(`${baseUrl}/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
}
