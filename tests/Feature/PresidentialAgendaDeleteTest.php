<?php

namespace Tests\Feature;

use App\Models\PresidentialAgendaItem;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PresidentialAgendaDeleteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['jwt.secret' => str_repeat('agenda-delete-test-secret', 4)]);

        $this->seed([
            PermissionSeeder::class,
            RolesSeeder::class,
            RolePermissionSeeder::class,
        ]);
    }

    public function test_technical_admin_can_delete_active_agenda_and_record_is_retained(): void
    {
        $actor = $this->user('Technical Administrator');
        $item = $this->item($actor);
        $url = '/api/presidential-agenda/'.$item->agenda_id;

        $this->authenticateApiUser($actor);

        $this->deleteJson($url)
            ->assertOk()
            ->assertJsonPath('data.status', 'deleted');

        $this->assertDatabaseHas('tblpresidential_agenda_items', [
            'agenda_id' => $item->agenda_id,
            'status' => 'deleted',
            'deleted_by' => $actor->user_id,
            'archived_at' => null,
        ]);

        $this->getJson('/api/presidential-agenda?status=all')
            ->assertOk()
            ->assertJsonMissing(['agenda_id' => $item->agenda_id]);

        $this->deleteJson($url)->assertUnprocessable();
    }

    public function test_technical_admin_without_delete_permission_cannot_delete(): void
    {
        $actor = $this->user('Technical Administrator');
        $item = $this->item($actor);

        $permissionIds = $actor->role->permissions()
            ->where('code', 'presidential_agenda.delete')
            ->pluck('tblpermissions.permission_id');

        $actor->role->permissions()->detach($permissionIds);

        $this->authenticateApiUser($actor->fresh());

        $this->deleteJson('/api/presidential-agenda/'.$item->agenda_id)
            ->assertForbidden();

        $this->assertDatabaseHas('tblpresidential_agenda_items', [
            'agenda_id' => $item->agenda_id,
            'status' => 'active',
            'deleted_at' => null,
        ]);
    }

    public function test_administrative_admin_must_archive_before_deleting(): void
    {
        $actor = $this->user('Administrative Admin');
        $item = $this->item($actor);
        $url = '/api/presidential-agenda/'.$item->agenda_id;

        $this->authenticateApiUser($actor);

        $this->deleteJson($url)->assertUnprocessable();

        $this->assertDatabaseHas('tblpresidential_agenda_items', [
            'agenda_id' => $item->agenda_id,
            'status' => 'active',
            'deleted_at' => null,
        ]);

        $this->patchJson($url.'/archive')->assertOk();
        $this->deleteJson($url)->assertOk();

        $this->assertDatabaseHas('tblpresidential_agenda_items', [
            'agenda_id' => $item->agenda_id,
            'status' => 'deleted',
            'deleted_by' => $actor->user_id,
        ]);
    }

    private function user(string $roleName): User
    {
        return User::create([
            'first_name' => 'Agenda',
            'last_name' => 'Tester',
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('password'),
            'status' => 'active',
            'role_id' => Role::where('role_name', $roleName)
                ->firstOrFail()->role_id,
        ])->refresh();
    }

    private function item(User $actor): PresidentialAgendaItem
    {
        return PresidentialAgendaItem::create([
            'code' => 'PA-TEST',
            'title' => 'Agenda deletion test',
            'description' => 'Disposable test item.',
            'created_by' => $actor->user_id,
        ])->refresh();
    }
}