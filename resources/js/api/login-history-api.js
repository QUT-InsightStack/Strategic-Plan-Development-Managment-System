import { apiRequest } from './api-client.js';

/**
 * The signed-in user's own sign-in history. The account is taken from the
 * token server-side, so there is nothing to pass here.
 */
export function myLoginHistory(limit = 10) {
    return apiRequest(`/api/login-history/me?limit=${encodeURIComponent(limit)}`);
}

/** Sign-in history across all accounts. Requires logs.view. */
export function listLoginHistory(params = {}) {
    const query = new URLSearchParams(
        Object.entries(params).filter(([, value]) => value !== '' && value != null)
    );

    return apiRequest(`/api/login-history?${query.toString()}`);
}
