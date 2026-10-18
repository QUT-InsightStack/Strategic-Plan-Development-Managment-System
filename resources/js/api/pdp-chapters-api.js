import { apiRequest } from './api-client.js';

const baseUrl = '/api/pdp-chapters';

export function listPdpChapters(filters = {}) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== '' && value != null));
    return apiRequest(`${baseUrl}?${query.toString()}`);
}

export function getPdpChapter(id) {
    return apiRequest(`${baseUrl}/${id}`);
}

export function createPdpChapter(data) {
    return apiRequest(baseUrl, { method: 'POST', body: JSON.stringify(data) });
}

export function updatePdpChapter(id, data) {
    return apiRequest(`${baseUrl}/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export function deletePdpChapter(id) {
    return apiRequest(`${baseUrl}/${id}`, { method: 'DELETE' });
}

/** Archive a chapter using the backend's PATCH lifecycle endpoint. */
export function archivePdpChapter(id) {
    return apiRequest(`${baseUrl}/${id}/archive`, { method: 'PATCH' });
}
