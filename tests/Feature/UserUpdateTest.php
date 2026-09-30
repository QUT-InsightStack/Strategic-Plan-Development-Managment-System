<?php

namespace Tests\Feature;

use App\Http\Middleware\ValidateAuthVersion;
use App\Models\Log;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserUpdateTest extends TestCase
{
    use RefreshDatabase;

    // ─── Authorisation ───────────────────────────────────────────────

    public function test_update_requires_authentication(): void
    {
        $target = $this->createUser();

        $this->putJson("/api/users/{$target->user_id}", ['first_name' => 'X'])
            ->assertUnauthorized();
    }

    public function test_user_without_update_permission_cannot_update_accounts(): void
    {
        $actor  = $this->createUserWithPermissions(['users.view']);
        $target = $this->createUser(['first_name' => 'Original']);

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['first_name' => 'Changed'])
            ->assertForbidden();

        $target->refresh();
        $this->assertSame('Original', $target->first_name);
    }

    // ─── Happy path ──────────────────────────────────────────────────

    public function test_authorised_administrator_can_update_a_user(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update']);
        $target = $this->createUser(['first_name' => 'Original']);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", [
                'first_name' => 'Updated',
                'last_name'  => 'Person',
                'office'     => 'Head Office',
                'department' => 'Planning',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.first_name', 'Updated')
            ->assertJsonPath('data.office', 'Head Office');

        $target->refresh();
        $this->assertSame('Updated', $target->first_name);
        $this->assertSame('Planning', $target->department);
    }

    public function test_response_does_not_expose_sensitive_fields(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update']);
        $target = $this->createUser();

        $this->actingAs($admin, 'api');
        $data = $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['first_name' => 'Updated'])
            ->assertOk()
            ->json('data');

        $this->assertArrayNotHasKey('password', $data);
        $this->assertArrayNotHasKey('remember_token', $data);
        $this->assertArrayNotHasKey('auth_version', $data);
    }

    public function test_unmodified_fields_are_left_unchanged(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update']);
        $target = $this->createUser([
            'first_name' => 'Keep',
            'department' => 'Planning',
            'office'     => 'Regional',
        ]);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['department' => 'Executive'])
            ->assertOk();

        $target->refresh();
        $this->assertSame('Executive', $target->department);
        $this->assertSame('Keep', $target->first_name);
        $this->assertSame('Regional', $target->office);
    }

    public function test_missing_user_returns_not_found(): void
    {
        $admin = $this->createUserWithPermissions(['users.update']);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson('/api/users/999999', ['first_name' => 'Ghost'])
            ->assertNotFound();
    }

    // ─── Email rules ─────────────────────────────────────────────────

    public function test_invalid_email_is_rejected(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update']);
        $target = $this->createUser();

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['email' => 'not-an-email'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_duplicate_email_is_rejected(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update']);
        $taken  = $this->createUser(['email' => 'taken@example.com']);
        $target = $this->createUser(['email' => 'target@example.com']);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['email' => 'taken@example.com'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $target->refresh();
        $this->assertSame('target@example.com', $target->email);
    }

    public function test_user_may_keep_their_existing_email(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update']);
        $target = $this->createUser(['email' => 'target@example.com']);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", [
                'email'      => 'target@example.com',
                'first_name' => 'Renamed',
            ])
            ->assertOk();
    }

    // ─── Restricted fields ───────────────────────────────────────────

    public function test_role_cannot_be_changed_through_this_endpoint(): void
    {
        $admin    = $this->createUserWithPermissions(['users.update']);
        $newRole  = Role::create(['role_name' => 'Elevated', 'is_assignable' => true]);
        $target   = $this->createUser();
        $original = $target->role_id;

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['role_id' => $newRole->role_id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('role_id');

        $target->refresh();
        $this->assertSame($original, $target->role_id);
    }

    /**
     * Status has its own endpoint which blocks self-suspension, protects the
     * last administrator and increments auth_version. Allowing it here would
     * bypass all three.
     */
    public function test_status_cannot_be_changed_through_this_endpoint(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update']);
        $target = $this->createUser(['status' => 'active']);
        $target->refresh();
        $originalVersion = (int) $target->auth_version;

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['status' => 'suspended'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $target->refresh();
        $this->assertSame('active', $target->status);
        $this->assertSame($originalVersion, (int) $target->auth_version);
    }

    // ─── Protected accounts ──────────────────────────────────────────

    public function test_protected_account_cannot_be_updated_without_the_protected_permission(): void
    {
        $admin = $this->createUserWithPermissions(['users.update']);

        $protectedRole = Role::create([
            'role_name'     => 'System Administrator',
            'is_assignable' => true,
            'is_protected'  => true,
        ]);
        $target = $this->createUser([
            'first_name' => 'Protected',
            'role_id'    => $protectedRole->role_id,
        ]);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['first_name' => 'Changed'])
            ->assertForbidden();

        $target->refresh();
        $this->assertSame('Protected', $target->first_name);
    }

    public function test_protected_account_can_be_updated_with_the_protected_permission(): void
    {
        $admin = $this->createUserWithPermissions([
            'users.update',
            'roles.assign_protected',
        ]);

        $protectedRole = Role::create([
            'role_name'     => 'System Administrator',
            'is_assignable' => true,
            'is_protected'  => true,
        ]);
        $target = $this->createUser([
            'first_name' => 'Protected',
            'role_id'    => $protectedRole->role_id,
        ]);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['first_name' => 'Changed'])
            ->assertOk();

        $target->refresh();
        $this->assertSame('Changed', $target->first_name);
    }

    // ─── Isolation and auditing ──────────────────────────────────────

    public function test_updating_one_user_does_not_affect_another(): void
    {
        $admin      = $this->createUserWithPermissions(['users.update']);
        $target     = $this->createUser(['first_name' => 'Target']);
        $bystander  = $this->createUser(['first_name' => 'Bystander']);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['first_name' => 'Renamed'])
            ->assertOk();

        $target->refresh();
        $bystander->refresh();
        $this->assertSame('Renamed', $target->first_name);
        $this->assertSame('Bystander', $bystander->first_name);
    }

    public function test_update_is_audited_against_the_acting_administrator(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update']);
        $target = $this->createUser();

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['first_name' => 'Audited'])
            ->assertOk();

        $this->assertDatabaseHas('tbllog', [
            'user_id' => $admin->user_id,
            'states'  => 'success',
        ]);

        $audit = Log::latest('log_id')->first();
        $this->assertSame('user.account_updated', $audit->operation);
        $this->assertSame($target->user_id, (int) $audit->resource_id);
        $this->assertContains('first_name', $audit->metadata['fields']);
    }

    public function test_updated_information_appears_in_search_results(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update', 'users.view']);
        $target = $this->createUser(['first_name' => 'Before']);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['first_name' => 'After'])
            ->assertOk();

        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/users/search?search=After&search_by=name')
            ->assertOk()
            ->assertJsonFragment(['first_name' => 'After']);
    }

    // ─── Date of birth and gender ────────────────────────────────────

    public function test_date_of_birth_and_gender_can_be_set(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update']);
        $target = $this->createUser();

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", [
                'date_of_birth' => '1990-04-17',
                'gender' => 'non_binary',
            ])
            ->assertOk()
            ->assertJsonPath('data.date_of_birth', '1990-04-17')
            ->assertJsonPath('data.gender', 'non_binary');

        $target->refresh();
        $this->assertSame('1990-04-17', $target->date_of_birth->format('Y-m-d'));
        $this->assertSame('non_binary', $target->gender);
    }

    public function test_a_date_of_birth_in_the_future_is_rejected(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update']);
        $target = $this->createUser();

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", [
                'date_of_birth' => now()->addDay()->format('Y-m-d'),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date_of_birth');
    }

    /**
     * Only the agreed codes are accepted. The column was a boolean until it
     * became clear nothing had ever defined which value meant what.
     */
    public function test_an_unrecognised_gender_code_is_rejected(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update']);
        $target = $this->createUser();

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['gender' => 'Female'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('gender');

        $this->assertNull($target->fresh()->gender);
    }

    public function test_both_fields_can_be_cleared(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update']);
        $target = $this->createUser([
            'date_of_birth' => '1990-04-17',
            'gender' => 'female',
        ]);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", [
                'date_of_birth' => null,
                'gender' => null,
            ])
            ->assertOk();

        $target->refresh();
        $this->assertNull($target->date_of_birth);
        $this->assertNull($target->gender);
    }

    /**
     * The dialog sends only changed fields, so an edit that leaves these
     * alone must not disturb them.
     */
    public function test_omitting_them_leaves_existing_values_untouched(): void
    {
        $admin  = $this->createUserWithPermissions(['users.update']);
        $target = $this->createUser([
            'date_of_birth' => '1990-04-17',
            'gender' => 'male',
        ]);

        $this->actingAs($admin, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/users/{$target->user_id}", ['first_name' => 'Renamed'])
            ->assertOk();

        $target->refresh();
        $this->assertSame('1990-04-17', $target->date_of_birth->format('Y-m-d'));
        $this->assertSame('male', $target->gender);
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

    /**
     * @param  list<string>  $codes
     */
    private function createUserWithPermissions(array $codes): User
    {
        $role = Role::create([
            'role_name'     => 'Role ' . fake()->unique()->word(),
            'is_assignable' => true,
            'is_protected'  => false,
        ]);

        foreach ($codes as $code) {
            $permission = Permission::firstOrCreate(
                ['code' => $code],
                [
                    'permission_name' => $code,
                    'description'     => $code,
                    'module'          => explode('.', $code)[0],
                ]
            );
            $role->permissions()->attach($permission->permission_id);
        }

        return $this->createUser(['role_id' => $role->role_id]);
    }
}
