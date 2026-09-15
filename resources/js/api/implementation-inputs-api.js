import { apiRequest } from './api-client.js';

export function submitObjectiveInput(objectiveId, { content, input_type }) {
    return apiRequest(`/api/strategic-objectives/${objectiveId}/inputs`, {
        method: 'POST', body: JSON.stringify({ content, input_type }),
    });
}

export function listObjectiveInputs(objectiveId, params = {}) {
    return apiRequest(`/api/strategic-objectives/${objectiveId}/inputs?${new URLSearchParams(params)}`);
}

export function submitPlanInput(planId, { content, input_type, objective_id = null }) {
    return apiRequest(`/api/strategic-plans/${planId}/inputs`, {
        method: 'POST', body: JSON.stringify({ content, input_type, objective_id }),
    });
}

export function listPlanInputs(planId, params = {}) {
    return apiRequest(`/api/strategic-plans/${planId}/inputs?${new URLSearchParams(params)}`);
}
