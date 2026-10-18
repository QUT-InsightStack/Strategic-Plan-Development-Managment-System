export async function apiRequest(url, options = {}) {
    const {
        redirectOnUnauthorized = true,
        ...requestOptions
    } = options;
    const isFormData = typeof FormData !== 'undefined' && requestOptions.body instanceof FormData;
    const response = await fetch(url, {
        credentials: 'include',
        ...requestOptions,
        headers: {
            Accept: 'application/json',
            ...(requestOptions.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
            ...(requestOptions.headers || {}),
        },
    });

    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && redirectOnUnauthorized) {
        window.location.href = '/login';
        throw new Error('Unauthenticated.');
    }
    if (!response.ok) {
        const error = new Error(payload.message || 'The request could not be completed.');
        error.status = response.status;
        error.errors = payload.errors || {};
        error.retryAfter = Number(response.headers.get('Retry-After')) || null;
        throw error;
    }
    return payload;
}
