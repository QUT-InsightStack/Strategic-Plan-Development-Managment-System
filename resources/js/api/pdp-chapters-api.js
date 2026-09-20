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

/**
 * Archive a chapter.
 *
 * Contract expected of the backend:
 *   POST /api/pdp-chapters/{id}/archive
 *   200 { success: true, message: string }
 *   404 when the chapter does not exist or is already archived
 *
 * Until that endpoint exists the request fails and the caller reports it.
 */
export function archivePdpChapter(id) {
    return apiRequest(`${baseUrl}/${id}/archive`, { method: 'POST' });
}
