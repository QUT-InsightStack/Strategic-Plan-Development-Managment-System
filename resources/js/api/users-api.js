import { apiRequest } from './api-client.js';

export function searchUsers(params = {}) {
    const query = new URLSearchParams(
        Object.entries(params).filter(([, value]) => value !== '' && value != null)
    );

    return apiRequest(`/api/users/search?${query.toString()}`);
}

export function listRoles() {
    return apiRequest('/api/roles');
}

export function updateUserStatus(userId, status) {
    return apiRequest(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    });
}

export function createUser(data) {
    return apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}
