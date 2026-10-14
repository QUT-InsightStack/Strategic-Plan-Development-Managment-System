<?php

namespace Tests\Feature;

use App\Models\PasswordAssistanceRequest;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PasswordAssistanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['jwt.secret' => str_repeat('assistance-test-secret', 4)]);

        $this->seed([
            PermissionSeeder::class,
            RolesSeeder::class,
            RolePermissionSeeder::class,
        ]);
    }

    public function test_submission_is_generic_and_duplicate_requests_are_prevented(): void
    {
        $user = $this->user('Planning Officer');

        $response = $this->postJson('/api/password-assistance-requests', [
            'email' => $user->email,
        ])->assertOk();

        $this->postJson('/api/password-assistance-requests', [
            'email' => $user->email,
        ])->assertOk()->assertExactJson($response->json());

        $this->postJson('/api/password-assistance-requests', [
            'email' => 'unknown@example.com',
        ])->assertOk()->assertExactJson($response->json());

        $this->assertDatabaseCount('password_assistance_requests', 1);
        $this->assertDatabaseHas('password_assistance_requests', [
            'user_id' => $user->user_id,
            'status' => 'pending',
            'open_slot' => 1,
        ]);
    }

    public function test_inbox_requires_authentication_and_admin_authority(): void
    {
        $this->getJson('/api/password-assistance-requests')
            ->assertUnauthorized();

        $this->authenticateApiUser($this->user('Planning Officer'));

        $this->getJson('/api/password-assistance-requests')
            ->assertForbidden();

        $this->postJson('/api/password-assistance-requests/1/accept')
            ->assertForbidden();
    }

    public function test_successful_reset_closes_request_and_invalidates_old_sessions(): void
    {
        $user = $this->user('Planning Officer');
        $admin = $this->user('Technical Administrator');
        $request = PasswordAssistanceRequest::create([
            'user_id' => $user->user_id,
        ]);
        $version = $user->auth_version;
        $password = 'NewSupportPassword123!';

        $this->authenticateApiUser($admin);
        $url = '/api/password-assistance-requests/'.$request->id;

        $this->postJson($url.'/reset', [
            'password' => $password,
            'password_confirmation' => $password,
        ])->assertUnprocessable();

        $this->postJson($url.'/accept')
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted');

        $this->postJson($url.'/reset', [
            'password' => $password,
            'password_confirmation' => $password,
        ])->assertOk()->assertJsonPath('data.status', 'acted_on');

        $this->assertTrue(Hash::check($password, $user->fresh()->password));
        $this->assertSame(
            (int) $version + 1,
            (int) $user->fresh()->auth_version
        );

        $this->assertDatabaseHas('password_assistance_requests', [
            'id' => $request->id,
            'status' => 'acted_on',
            'open_slot' => null,
            'handled_by' => $admin->user_id,
        ]);

        $this->postJson($url.'/reset', [
            'password' => $password,
            'password_confirmation' => $password,
        ])->assertUnprocessable();
    }

    public function test_another_admin_cannot_reset_an_accepted_request(): void
    {
        $user = $this->user('Planning Officer');
        $first = $this->user('Technical Administrator');
        $second = $this->user('Technical Administrator');
        $request = PasswordAssistanceRequest::create([
            'user_id' => $user->user_id,
        ]);
        $oldHash = $user->password;
        $url = '/api/password-assistance-requests/'.$request->id;

        $this->authenticateApiUser($first);
        $this->postJson($url.'/accept')->assertOk();

        $this->authenticateApiUser($second);

        $this->postJson($url.'/reset', [
            'password' => 'NewSupportPassword123!',
            'password_confirmation' => 'NewSupportPassword123!',
        ])->assertForbidden();

        $this->assertSame($oldHash, $user->fresh()->password);
        $this->assertSame('accepted', $request->fresh()->status);
    }

    public function test_ignoring_request_does_not_change_password_and_allows_new_request(): void
    {
        $user = $this->user('Planning Officer');
        $admin = $this->user('Technical Administrator');
        $request = PasswordAssistanceRequest::create([
            'user_id' => $user->user_id,
        ]);
        $oldHash = $user->password;

        $this->authenticateApiUser($admin);

        $this->postJson(
            '/api/password-assistance-requests/'.$request->id.'/ignore'
        )->assertOk()->assertJsonPath('data.status', 'ignored');

        $this->assertSame($oldHash, $user->fresh()->password);
        $this->assertNull($request->fresh()->open_slot);

        $this->postJson('/api/password-assistance-requests', [
            'email' => $user->email,
        ])->assertOk();

        $this->assertDatabaseCount('password_assistance_requests', 2);
    }

    private function user(string $roleName): User
    {
        return User::create([
            'first_name' => 'Support',
            'last_name' => 'Tester',
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('OriginalPassword123!'),
            'status' => 'active',
            'role_id' => Role::where('role_name', $roleName)
                ->firstOrFail()->role_id,
        ])->refresh();
    }
}