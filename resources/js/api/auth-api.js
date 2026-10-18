import { apiRequest } from './api-client.js';

export function login(credentials, url = '/api/auth/login') {
    return apiRequest(url, {
        method: 'POST',
        body: JSON.stringify(credentials),
        redirectOnUnauthorized: false,
    });
}

export function getCurrentUser() {
    return apiRequest('/api/auth/me');
}

export function updateProfile(data) {
    return apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export function changePassword(data) {
    return apiRequest('/api/change-password', {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export function logoutUser() {
    return apiRequest('/api/auth/logout', {
        method: 'POST',
        redirectOnUnauthorized: false,
    });
}

export function resetPassword(data, url = '/api/reset-password') {
    return apiRequest(url, {
        method: 'POST',
        body: JSON.stringify(data),
        redirectOnUnauthorized: false,
    });
}
