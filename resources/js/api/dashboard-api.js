import { apiRequest } from './api-client.js';

export function getDashboardModule(moduleId) {
    return apiRequest(`/api/${encodeURIComponent(moduleId)}`);
}
