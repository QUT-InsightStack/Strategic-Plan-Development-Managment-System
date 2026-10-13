import { apiRequest } from './api-client.js';

export function listSubmittedInputs(params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
    return apiRequest(`/api/implementation-inputs?${query}`);
}

export function getSubmittedInput(inputId) {
    return apiRequest(`/api/implementation-inputs/${inputId}`);
}

export function reviewSubmittedInput(inputId, { status, review_note }) {
    return apiRequest(`/api/implementation-inputs/${inputId}/review`, {
        method: 'POST', body: JSON.stringify({ status, review_note }),
    });
}

export function listObjectiveInputs(objectiveId, params = {}) {
    return apiRequest(`/api/strategic-objectives/${objectiveId}/inputs?${new URLSearchParams(params)}`);
}

export function submitPlanInput(planId, {
    content,
    input_type,
    objective_id = null,
    feedback_category = null,
    mapping_type = null,
    mapping_reference_id = null,
}) {
    const body = { content, input_type, objective_id };

    if (feedback_category) body.feedback_category = feedback_category;
    if (mapping_type) body.mapping_type = mapping_type;
    if (mapping_reference_id != null) {
        body.mapping_reference_id = Number(mapping_reference_id);
    }

    return apiRequest(`/api/strategic-plans/${planId}/inputs`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function listPlanInputs(planId, params = {}) {
    return apiRequest(`/api/strategic-plans/${planId}/inputs?${new URLSearchParams(params)}`);
}
