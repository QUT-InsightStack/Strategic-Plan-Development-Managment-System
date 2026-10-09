import { apiRequest } from './api-client.js';

export function getSecuritySettings() {
    return apiRequest('/api/security-settings');
}
