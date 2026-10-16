import { apiRequest } from './api-client.js';

export function listManagementComments(filters = {}) {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
            params.set(key, String(value));
        }
    });

    return apiRequest(`/api/management-objective-comments?${params}`);
}

export function addManagementComment(objectiveId, content) {
    return apiRequest(
        `/api/strategic-objectives/${objectiveId}/management-comments`,
        {
            method: 'POST',
            body: JSON.stringify({ content }),
        }
    );
}

export function acknowledgeManagementComment(commentId) {
    return apiRequest(
        `/api/management-objective-comments/${commentId}/acknowledge`,
        { method: 'POST' }
    );
}

export function closeManagementComment(
    commentId,
    completionStatus,
    closingRemarks
) {
    return apiRequest(
        `/api/management-objective-comments/${commentId}/close`,
        {
            method: 'POST',
            body: JSON.stringify({
                completion_status: completionStatus,
                closing_remarks: closingRemarks,
            }),
        }
    );
}