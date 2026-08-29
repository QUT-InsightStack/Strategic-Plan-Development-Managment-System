/**
 * Profile photo upload.
 *
 * Not built on apiRequest: that helper sets a JSON content type whenever
 * there is a body, which would stop the browser writing the multipart
 * boundary and the upload would arrive empty.
 */

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const PHOTO_ACCEPT = ACCEPTED_TYPES.join(',');

/**
 * Check a file before sending it, so an obviously wrong one is refused
 * without a round trip. The server repeats every one of these checks — this
 * is for speed, not safety.
 *
 * @returns {string} an error message, or '' when the file looks usable
 */
export function checkPhoto(file) {
    if (!file) return 'Choose an image to upload.';
    if (!ACCEPTED_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP image.';
    if (file.size > MAX_BYTES) return 'The image must be 2 MB or smaller.';
    return '';
}

async function readError(response, fallback) {
    const payload = await response.json().catch(() => ({}));
    const fieldError = payload.errors?.photo?.[0];
    const error = new Error(fieldError || payload.message || fallback);
    error.status = response.status;
    return error;
}

export async function uploadProfilePhoto(file) {
    const body = new FormData();
    body.append('photo', file);

    const response = await fetch('/api/auth/profile/photo', {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        body,
    });

    if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Unauthenticated.');
    }

    if (!response.ok) {
        throw await readError(response, 'The photo could not be uploaded.');
    }

    return response.json();
}

export async function removeProfilePhoto() {
    const response = await fetch('/api/auth/profile/photo', {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });

    if (response.status === 401) {
        window.location.href = '/login';
        throw new Error('Unauthenticated.');
    }

    if (!response.ok) {
        throw await readError(response, 'The photo could not be removed.');
    }

    return response.json();
}
