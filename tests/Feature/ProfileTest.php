<?php

namespace Tests\Feature;

use App\Http\Middleware\ValidateAuthVersion;
use App\Models\Log;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    // ─── Access ──────────────────────────────────────────────────────

    public function test_profile_page_is_available(): void
    {
        $this->get('/profile')->assertOk();
    }

    public function test_profile_endpoints_require_authentication(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();
        $this->putJson('/api/auth/profile', ['first_name' => 'Test'])
            ->assertUnauthorized();
    }

    // ─── Viewing ─────────────────────────────────────────────────────

    public function test_authenticated_user_can_view_own_profile(): void
    {
        $user = $this->createUser(['designation' => 'Senior Analyst']);

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.email', $user->email)
            ->assertJsonPath('data.first_name', 'Test')
            ->assertJsonPath('data.designation', 'Senior Analyst');
    }

    public function test_profile_response_does_not_expose_password(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $response = $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/auth/me')
            ->assertOk();

        $this->assertArrayNotHasKey('password', $response->json('data'));
        $this->assertArrayNotHasKey('remember_token', $response->json('data'));
    }

    // ─── Updating ────────────────────────────────────────────────────

    public function test_user_can_update_permitted_profile_fields(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', [
                'first_name'  => 'Updated',
                'last_name'   => 'Name',
                'mobile'      => '0400000000',
                'address'     => '2 George St, Brisbane',
                'designation' => 'Principal Advisor',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.first_name', 'Updated')
            ->assertJsonPath('data.designation', 'Principal Advisor');

        $user->refresh();
        $this->assertSame('Updated', $user->first_name);
        $this->assertSame('Principal Advisor', $user->designation);
        $this->assertSame('0400000000', $user->mobile);
    }

    public function test_unmodified_fields_are_left_unchanged(): void
    {
        $user = $this->createUser([
            'designation' => 'Analyst',
            'address'     => 'Original address',
        ]);

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', ['first_name' => 'OnlyThis'])
            ->assertOk();

        $user->refresh();
        $this->assertSame('OnlyThis', $user->first_name);
        $this->assertSame('Analyst', $user->designation);
        $this->assertSame('Original address', $user->address);
    }

    public function test_profile_update_is_audited(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', ['designation' => 'Director'])
            ->assertOk();

        $this->assertDatabaseHas('tbllog', [
            'user_id' => $user->user_id,
            'states'  => 'success',
        ]);
        $this->assertStringContainsString(
            'designation',
            (string) Log::latest('log_id')->value('operation')
        );
    }

    // ─── Validation ──────────────────────────────────────────────────

    public function test_invalid_email_is_rejected(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', ['email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_email_already_used_by_another_user_is_rejected(): void
    {
        $other = $this->createUser(['email' => 'taken@example.com']);
        $user  = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', ['email' => 'taken@example.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_user_may_resubmit_their_own_email(): void
    {
        $user = $this->createUser(['email' => 'mine@example.com']);

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', ['email' => 'mine@example.com'])
            ->assertOk();
    }

    public function test_overlong_designation_is_rejected(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', ['designation' => str_repeat('a', 256)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('designation');
    }

    // ─── Restricted fields ───────────────────────────────────────────

    public function test_role_cannot_be_changed_through_profile(): void
    {
        $role  = Role::create(['role_name' => 'Administrator']);
        $user  = $this->createUser();
        $originalRoleId = $user->role_id;

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', [
                'first_name' => 'Updated',
                'role_id'    => $role->role_id,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role_id');

        $user->refresh();
        $this->assertSame($originalRoleId, $user->role_id);
        $this->assertNotSame('Updated', $user->first_name);
    }

    public function test_status_cannot_be_changed_through_profile(): void
    {
        $user = $this->createUser();

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', ['status' => 'suspended'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $user->refresh();
        $this->assertSame('active', $user->status);
    }

    public function test_organisational_fields_cannot_be_changed_through_profile(): void
    {
        $user = $this->createUser(['department' => 'Planning']);

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', [
                'department' => 'Executive',
                'unit'       => 'Strategy',
                'office'     => 'Head Office',
                'position'   => 'Chief',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['department', 'unit', 'office', 'position']);

        $user->refresh();
        $this->assertSame('Planning', $user->department);
    }

    public function test_password_cannot_be_changed_through_profile(): void
    {
        $user = $this->createUser();
        $originalHash = $user->password;

        $this->actingAs($user, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', ['password' => 'new-password-123'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');

        $user->refresh();
        $this->assertSame($originalHash, $user->password);
    }

    // ─── Isolation between users ─────────────────────────────────────

    public function test_user_cannot_update_another_users_profile(): void
    {
        $victim = $this->createUser(['first_name' => 'Victim']);
        $actor  = $this->createUser(['first_name' => 'Actor']);

        // user_id is restricted, so an attempt to target another account
        // is rejected outright rather than silently ignored.
        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', [
                'user_id'    => $victim->user_id,
                'first_name' => 'Hijacked',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('user_id');

        $victim->refresh();
        $actor->refresh();
        $this->assertSame('Victim', $victim->first_name);
        $this->assertSame('Actor', $actor->first_name);
    }

    public function test_update_only_ever_writes_to_the_authenticated_user(): void
    {
        $other = $this->createUser(['first_name' => 'Other']);
        $actor = $this->createUser(['first_name' => 'Actor']);

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/auth/profile', ['first_name' => 'Renamed'])
            ->assertOk();

        $actor->refresh();
        $other->refresh();
        $this->assertSame('Renamed', $actor->first_name);
        $this->assertSame('Other', $other->first_name);
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    private function createUser(array $attributes = []): User
    {
        return User::create(array_merge([
            'first_name' => 'Test',
            'last_name'  => 'User',
            'email'      => fake()->unique()->safeEmail(),
            'password'   => Hash::make('password'),
            'status'     => 'active',
        ], $attributes));
    }
}
