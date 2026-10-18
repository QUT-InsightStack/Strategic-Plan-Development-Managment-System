import { apiRequest } from './api-client.js';

const baseUrl = '/api/logs';

/**
 * Search the audit trail.
 *
 * Empty filters are dropped rather than sent blank: the API validates several
 * of them (`user_id` must exist, dates must be Y-m-d), so an empty string
 * would be rejected instead of ignored.
 */
export function listLogs(filters = {}) {
    const query = new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== '' && value != null)
    );

    return apiRequest(`${baseUrl}?${query.toString()}`);
}

export function getLog(logId) {
    return apiRequest(`${baseUrl}/${logId}`);
}
