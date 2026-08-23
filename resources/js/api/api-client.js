export async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers: {
            Accept: 'application/json',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {}),
        },
    });

    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Unauthenticated.');
    }
    if (!response.ok) {
        const error = new Error(payload.message || 'The request could not be completed.');
        error.status = response.status;
        error.errors = payload.errors || {};
        throw error;
    }
    return payload;
}
