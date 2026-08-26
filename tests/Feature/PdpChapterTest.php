<?php

namespace Tests\Feature;

use App\Http\Middleware\ValidateAuthVersion;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PdpChapterTest extends TestCase
{
    use RefreshDatabase;

    public function test_pdp_chapter_pages_are_available(): void
    {
        $this->get('/pdp-chapters')->assertOk()->assertSee('PDP Chapters');
        $this->get('/pdp-chapters/manage')->assertOk()->assertSee('Manage PDP Chapters');
        $this->get('/pdp-chapters/1')->assertOk()->assertSee('PDP Chapter Details');
    }

    public function test_pdp_chapter_apis_require_authentication(): void
    {
        $this->getJson('/api/pdp-chapters')->assertUnauthorized();
        $this->getJson('/api/pdp-chapters/1')->assertUnauthorized();
        $this->postJson('/api/pdp-chapters', [])->assertUnauthorized();
    }

    public function test_authenticated_user_can_view_but_cannot_manage_chapters(): void
    {
        $viewer = $this->createUser('Planning Officer');
        $this->actingAs($viewer, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class);

        $this->getJson('/api/pdp-chapters')->assertOk();
        $this->postJson('/api/pdp-chapters', [
            'chapter_title' => 'Chapter 1',
            'chapter_description' => 'Planning context.',
        ])->assertForbidden();
    }

    public function test_administrator_can_create_and_update_a_chapter(): void
    {
        $administrator = $this->createUser('Administrator', true);
        $this->actingAs($administrator, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class);

        $createResponse = $this->postJson('/api/pdp-chapters', [
            'chapter_title' => 'Development Context',
            'chapter_description' => str_repeat('Current conditions and planning assumptions. ', 150),
        ])->assertCreated()->assertJsonPath('data.chapter_title', 'Development Context');

        $chapterId = $createResponse->json('data.chapter_id');

        $this->putJson("/api/pdp-chapters/{$chapterId}", [
            'chapter_title' => 'Updated Development Context',
            'chapter_description' => 'Updated planning context.',
        ])->assertOk()->assertJsonPath('data.chapter_title', 'Updated Development Context');

        $this->assertDatabaseHas('tblpdp_chapters', [
            'chapter_id' => $chapterId,
            'chapter_title' => 'Updated Development Context',
        ]);
    }

    private function createUser(string $roleName, bool $canManage = false): User
    {
        $role = Role::create([
            'role_name' => $roleName,
            'description' => 'Test role',
            'is_assignable' => true,
            'is_protected' => $roleName === 'Administrator',
        ]);

        if ($canManage) {
            $permission = Permission::create([
                'permission_name' => 'Manage PDP Chapters',
                'description' => 'Manage PDP Chapters',
                'code' => 'pdp_chapters.manage',
                'module' => 'pdp_chapters',
            ]);
            $role->permissions()->attach($permission->permission_id);
        }

        return User::create([
            'first_name' => 'PDP',
            'last_name' => $roleName,
            'email' => strtolower(str_replace(' ', '.', $roleName)) . '@example.com',
            'password' => Hash::make('password'),
            'role_id' => $role->role_id,
            'status' => 'active',
        ]);
    }
}
