<?php

namespace Tests\Feature;

use App\Http\Middleware\ValidateAuthVersion;
use App\Models\Log;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Note: the tests that build a real image need the GD extension, which
 * UploadedFile::fake()->image() relies on.
 */
class ProfilePhotoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    // ─── Authorisation ───────────────────────────────────────────────

    public function test_uploading_requires_authentication(): void
    {
        $this->postJson('/api/auth/profile/photo', [
            'photo' => UploadedFile::fake()->image('me.jpg'),
        ])->assertUnauthorized();
    }

    public function test_removing_requires_authentication(): void
    {
        $this->deleteJson('/api/auth/profile/photo')->assertUnauthorized();
    }

    // ─── Uploading ───────────────────────────────────────────────────

    public function test_a_valid_image_is_stored_and_recorded_against_the_user(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $response = $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/auth/profile/photo', [
                'photo' => UploadedFile::fake()->image('me.jpg', 200, 200),
            ])
            ->assertOk()
            ->assertJsonPath('success', true);

        $user->refresh();

        $this->assertNotNull($user->profile_picture);
        $this->assertStringStartsWith('/storage/avatars/', $user->profile_picture);
        $this->assertSame($user->profile_picture, $response->json('data.profile_picture'));

        Storage::disk('public')->assertExists('avatars/' . basename($user->profile_picture));
    }

    /**
     * A client-supplied name could carry a path, a second extension, or
     * characters the filesystem treats specially, so it is never used.
     */
    public function test_the_stored_filename_does_not_come_from_the_client(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/auth/profile/photo', [
                'photo' => UploadedFile::fake()->image('../../evil name.jpg', 64, 64),
            ])
            ->assertOk();

        $user->refresh();
        $filename = basename($user->profile_picture);

        $this->assertStringNotContainsString('evil', $filename);
        $this->assertStringNotContainsString(' ', $filename);
        $this->assertStringNotContainsString('..', $user->profile_picture);
        $this->assertMatchesRegularExpression('/^[a-z0-9]{40}\.[a-z0-9]+$/', $filename);
    }

    public function test_a_file_that_is_not_an_image_is_rejected(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/auth/profile/photo', [
                'photo' => UploadedFile::fake()->create('notes.txt', 8, 'text/plain'),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('photo');

        $this->assertNull($user->fresh()->profile_picture);
    }

    /**
     * The `image` rule reads the file itself, so claiming an image mime type
     * is not enough to get a non-image accepted.
     */
    public function test_a_non_image_claiming_to_be_a_jpeg_is_rejected(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/auth/profile/photo', [
                'photo' => UploadedFile::fake()->create('payload.jpg', 8, 'image/jpeg'),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('photo');

        $this->assertNull($user->fresh()->profile_picture);
    }

    public function test_an_oversized_image_is_rejected(): void
    {
        $user = $this->createUser();

        // size() takes kilobytes; the rule caps the upload at 2048.
        $photo = UploadedFile::fake()->image('huge.jpg', 500, 500)->size(3000);

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/auth/profile/photo', ['photo' => $photo])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('photo');
    }

    public function test_a_missing_file_is_rejected(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/auth/profile/photo', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('photo');
    }

    public function test_uploading_is_audited(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/auth/profile/photo', [
                'photo' => UploadedFile::fake()->image('me.jpg', 64, 64),
            ])
            ->assertOk();

        $this->assertDatabaseHas('tbllog', [
            'user_id' => $user->user_id,
            'operation' => 'profile.photo_updated',
            'states' => 'success',
        ]);
    }

    // ─── Replacing and removing ──────────────────────────────────────

    public function test_replacing_a_photo_deletes_the_previous_file(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/auth/profile/photo', [
                'photo' => UploadedFile::fake()->image('first.jpg', 64, 64),
            ])
            ->assertOk();

        $first = basename($user->fresh()->profile_picture);

        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/auth/profile/photo', [
                'photo' => UploadedFile::fake()->image('second.jpg', 64, 64),
            ])
            ->assertOk();

        $second = basename($user->fresh()->profile_picture);

        $this->assertNotSame($first, $second);
        Storage::disk('public')->assertMissing('avatars/' . $first);
        Storage::disk('public')->assertExists('avatars/' . $second);
    }

    public function test_removing_clears_the_photo_and_deletes_the_file(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/auth/profile/photo', [
                'photo' => UploadedFile::fake()->image('me.jpg', 64, 64),
            ])
            ->assertOk();

        $filename = basename($user->fresh()->profile_picture);

        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->deleteJson('/api/auth/profile/photo')
            ->assertOk();

        $this->assertNull($user->fresh()->profile_picture);
        Storage::disk('public')->assertMissing('avatars/' . $filename);

        $this->assertDatabaseHas('tbllog', [
            'user_id' => $user->user_id,
            'operation' => 'profile.photo_removed',
        ]);
    }

    /**
     * Only files this service stored are ours to delete. Anything else — an
     * external URL, or a value left over from before photos were files —
     * is left where it is.
     */
    public function test_a_file_outside_the_avatars_directory_is_never_deleted(): void
    {
        $user = $this->createUser();
        Storage::disk('public')->put('other/keep.png', 'not ours');

        $user->profile_picture = '/storage/other/keep.png';
        $user->save();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/auth/profile/photo', [
                'photo' => UploadedFile::fake()->image('me.jpg', 64, 64),
            ])
            ->assertOk();

        Storage::disk('public')->assertExists('other/keep.png');
    }

    public function test_one_user_cannot_affect_another_users_photo(): void
    {
        $user = $this->createUser();
        $other = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/auth/profile/photo', [
                'photo' => UploadedFile::fake()->image('me.jpg', 64, 64),
            ])
            ->assertOk();

        $this->assertNotNull($user->fresh()->profile_picture);
        $this->assertNull($other->fresh()->profile_picture);
    }

    // ─── The JSON profile endpoint ───────────────────────────────────

    /**
     * Sending the image through the profile endpoint is what used to fail:
     * a data URL is far longer than the column. It is now refused outright.
     */
    public function test_the_profile_endpoint_rejects_a_profile_picture(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', [
                'first_name' => 'Jane',
                'profile_picture' => 'data:image/png;base64,' . str_repeat('A', 500),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('profile_picture');

        $this->assertNull($user->fresh()->profile_picture);
    }

    // ─── Helper ──────────────────────────────────────────────────────

    private function createUser(): User
    {
        return User::create([
            'first_name' => 'Test',
            'last_name' => 'User',
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('password'),
            'status' => 'active',
        ]);
    }
}
