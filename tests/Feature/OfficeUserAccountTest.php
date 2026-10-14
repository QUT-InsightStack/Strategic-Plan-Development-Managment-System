<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OfficeUserAccountTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([
            PermissionSeeder::class,
            RolesSeeder::class,
            RolePermissionSeeder::class,
        ]);

        $admin = $this->makeUser('Technical Administrator');

        $this->authenticateApiUser($admin);
    }

    private function makeUser(string $roleName, ?string $office = null): User
    {
        return User::create([
            'first_name' => 'Account',
            'last_name' => 'Test',
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('AccountPassword123!'),
            'status' => 'active',
            'office' => $office,
            'role_id' => Role::where('role_name', $roleName)
                ->firstOrFail()->role_id,
        ])->refresh();
    }

    public function test_office_creation_requires_non_blank_office(): void
    {
        $payload = [
            'first_name' => 'New',
            'last_name' => 'Office User',
            'email' => 'new-office@example.com',
            'password' => 'AccountPassword123!',
            'role_id' => Role::where('role_name', 'Office')
                ->firstOrFail()->role_id,
        ];

        foreach ([null, '', '   '] as $office) {
            $this->postJson('/api/users', [
                ...$payload,
                'office' => $office,
            ])->assertUnprocessable()
                ->assertJsonValidationErrors('office');

            $this->assertDatabaseMissing('tblusers', [
                'email' => $payload['email'],
            ]);
        }

        $this->postJson('/api/users', [
            ...$payload,
            'office' => 'Research Office',
        ])->assertCreated();

        $this->assertDatabaseHas('tblusers', [
            'email' => $payload['email'],
            'office' => 'Research Office',
        ]);
    }

    public function test_office_details_cannot_be_cleared_but_other_fields_can_change(): void
    {
        $user = $this->makeUser('Office', 'Research Office');

        foreach ([null, '', '   '] as $office) {
            $this->putJson("/api/users/{$user->user_id}", [
                'office' => $office,
            ])->assertUnprocessable()
                ->assertJsonValidationErrors('office');

            $this->assertSame(
                'Research Office',
                $user->fresh()->office
            );
        }

        $this->putJson("/api/users/{$user->user_id}", [
            'first_name' => 'Updated',
        ])->assertOk();

        $this->assertSame('Updated', $user->fresh()->first_name);
        $this->assertSame('Research Office', $user->fresh()->office);
    }

    public function test_office_role_assignment_requires_office_details(): void
    {
        $user = $this->makeUser('Management');
        $originalRoleId = $user->role_id;
        $originalVersion = $user->auth_version;
        $officeRoleId = Role::where('role_name', 'Office')
            ->firstOrFail()->role_id;

        $this->putJson("/api/users/{$user->user_id}/role", [
            'role_id' => $officeRoleId,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('role_id');

        $this->assertSame($originalRoleId, $user->fresh()->role_id);
        $this->assertSame($originalVersion, $user->fresh()->auth_version);

        $this->putJson("/api/users/{$user->user_id}", [
            'office' => 'Research Office',
        ])->assertOk();

        $this->putJson("/api/users/{$user->user_id}/role", [
            'role_id' => $officeRoleId,
        ])->assertOk();

        $this->assertSame($officeRoleId, $user->fresh()->role_id);
    }

    public function test_other_roles_can_have_no_office(): void
    {
        $user = $this->makeUser('Management', 'Research Office');

        $this->putJson("/api/users/{$user->user_id}", [
            'office' => null,
        ])->assertOk();

        $this->assertNull($user->fresh()->office);
    }
}