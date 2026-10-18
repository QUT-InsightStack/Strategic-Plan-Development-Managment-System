import { apiRequest } from './api-client.js';

export function resourceRequest(url, options = {}) {
    return apiRequest(url, options);
}
