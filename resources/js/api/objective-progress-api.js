import { apiRequest } from './api-client.js';

export const progressStatusLabel = status => ({ not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed' }[status] || status);

export function calculatedProgressStatus(value) {
    if (value === '' || value == null) return '';
    const percentage = Number(value);
    if (!Number.isInteger(percentage) || percentage < 0 || percentage > 100) return '';
    return percentage === 0 ? 'not_started' : percentage === 100 ? 'completed' : 'in_progress';
}

export function listObjectiveProgress(params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null));
    return apiRequest(`/api/strategic-objective-progress?${query}`);
}

export function updateObjectiveProgress(id, percentage, reason = '') {
    return apiRequest(`/api/strategic-objectives/${id}/progress`, {
        method: 'PATCH', body: JSON.stringify({ progress_percentage: Number(percentage), reason: reason.trim() || null }),
    });
}

export function listObjectiveProgressHistory(id, page = 1) {
    return apiRequest(`/api/strategic-objectives/${id}/progress-history?page=${page}`);
}
