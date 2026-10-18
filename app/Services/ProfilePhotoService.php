<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Stores profile photos as files on the public disk.
 *
 * The alternative the page used before — a base64 data URL written into
 * tblusers.profile_picture — could not work: that column is VARCHAR(255) and
 * an encoded photo is tens of thousands of characters, so every upload failed
 * at the database. The column now holds a short path instead.
 */
class ProfilePhotoService
{
    public function __construct(private readonly StrategicLogWriter $logWriter) {}

    private const DISK = 'public';
    private const DIRECTORY = 'avatars';

    /** Only paths in this shape are ours to delete. */
    private const PUBLIC_PREFIX = '/storage/' . self::DIRECTORY . '/';

    /**
     * Replace a user's photo and return the fresh record.
     */
    public function store(User $user, UploadedFile $photo): User
    {
        $previous = $user->profile_picture;

        // Named by us, never by the client: an uploaded name could carry a
        // path, a second extension, or characters the filesystem treats
        // specially. The extension is derived from the file's own contents
        // rather than what it was called.
        $extension = $photo->extension() ?: 'jpg';
        $filename = Str::lower(Str::random(40)) . '.' . $extension;

        $photo->storeAs(self::DIRECTORY, $filename, [
            'disk' => self::DISK,
            'visibility' => 'public',
        ]);

        $user->profile_picture = self::PUBLIC_PREFIX . $filename;
        $user->save();

        // Only after the new one is safely saved, so a failed write never
        // leaves the user with no photo at all.
        $this->deleteStoredFile($previous);

        $this->audit($user, 'profile.photo_updated');

        return $user->fresh();
    }

    /**
     * Remove the current photo, falling back to the default avatar.
     */
    public function remove(User $user): User
    {
        $previous = $user->profile_picture;

        $user->profile_picture = null;
        $user->save();

        $this->deleteStoredFile($previous);

        $this->audit($user, 'profile.photo_removed');

        return $user->fresh();
    }

    /**
     * Delete a file this service stored.
     *
     * Anything that is not one of our own paths is left alone — an external
     * URL, or a leftover data URL from before photos were stored as files.
     * The basename check keeps a tampered value from reaching outside the
     * avatars directory.
     */
    private function deleteStoredFile(?string $path): void
    {
        if (! is_string($path) || ! str_starts_with($path, self::PUBLIC_PREFIX)) {
            return;
        }

        $filename = basename($path);

        if ($filename === '' || $filename === '.' || $filename === '..') {
            return;
        }

        Storage::disk(self::DISK)->delete(self::DIRECTORY . '/' . $filename);
    }

    private function audit(User $user, string $event): void
    {
        $this->logWriter->write($event, [
            'actor_user_id' => $user->user_id,
            'resource_type' => 'user', 'resource_id' => $user->user_id,
            'states' => 'success',
        ]);
    }
}
