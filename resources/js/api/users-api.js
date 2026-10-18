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
    return apiRequest(`/api/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}

export function createUser(data) {
    return apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

/**
 * Update another user's account details.
 *
 * Role and account status are deliberately not accepted here: each has its
 * own endpoint that applies safeguards this one does not.
 */
export function updateUser(userId, data) {
    return apiRequest(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export function assignUserRole(userId, roleId) {
    return apiRequest(`/api/users/${userId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role_id: Number(roleId) }),
    });
}
