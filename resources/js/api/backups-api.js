import { apiRequest } from './api-client.js';

export function listBackups(params = {}) {
    const query = new URLSearchParams(
        Object.entries(params).filter(([, value]) => value !== '' && value != null)
    );

    return apiRequest(`/api/backups?${query.toString()}`);
}

export function createBackup() {
    return apiRequest('/api/backups', { method: 'POST' });
}

/**
 * Download a backup file.
 *
 * Fetched as a blob rather than navigating to the URL, so a 403 or a missing
 * file surfaces as an error on the page instead of dumping a JSON body into a
 * new browser tab. The session cookie is sent the same way apiRequest sends
 * it.
 */
export async function downloadBackup(backupId, filename) {
    const response = await fetch(`/api/backups/${backupId}/download`, {
        credentials: 'include',
        headers: { Accept: 'application/octet-stream' },
    });

    if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Unauthenticated.');
    }

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const error = new Error(payload.message || 'The backup could not be downloaded.');
        error.status = response.status;
        throw error;
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    try {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
    } finally {
        // Released on the next tick so the click has started the save.
        window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    }
}
