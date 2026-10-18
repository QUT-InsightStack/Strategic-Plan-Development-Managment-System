const baseUrl = '/api/system-monitoring';

function query(params = {}) {
    const search = new URLSearchParams(
        Object.entries(params).filter(([, value]) => value !== '' && value !== null && value !== undefined && value !== false)
    );
    const text = search.toString();
    return text ? `?${text}` : '';
}

/*
 * The health endpoint answers 503 when a dependency is unhealthy but still
 * returns the check results, so this client keeps the payload for any status
 * listed in `acceptStatuses` instead of treating it as a failure.
 */
async function monitoringRequest(path, params, acceptStatuses = []) {
    const response = await fetch(`${baseUrl}${path}${query(params)}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Unauthenticated.');
    }

    if (!response.ok && !acceptStatuses.includes(response.status)) {
        const error = new Error(
            response.status === 403 ? 'You do not have permission to view system monitoring.'
                : response.status === 404 ? 'The system monitoring service is not available on this server yet.'
                : payload.message || 'System monitoring data could not be loaded.'
        );
        error.status = response.status;
        error.errors = payload.errors || {};
        throw error;
    }

    return payload;
}

export const getMonitoringSummary = (params) => monitoringRequest('/summary', params);
export const getMonitoringHealth = () => monitoringRequest('/health', {}, [503]);
export const listMonitoringEvents = (params) => monitoringRequest('/events', params);
export const getMonitoringEvent = (id) => monitoringRequest(`/events/${encodeURIComponent(id)}`);
export const listMonitoringAlerts = (params) => monitoringRequest('/alerts', params);
export const listMonitoringRequests = (params) => monitoringRequest('/requests', params);
export const listMonitoringTrends = (params) => monitoringRequest('/trends', params);
export const listMonitoringChecks = (params) => monitoringRequest('/checks', params);
