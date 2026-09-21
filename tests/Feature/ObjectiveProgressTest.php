<?php

namespace Tests\Feature;

use App\Models\ObjectiveProgressUpdate;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use App\Services\PlanCreationService;
use App\Services\ResponsibleUnitService;
use Database\Seeders\ObjectiveProgressPermissionSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ObjectiveProgressTest extends TestCase
{
    use RefreshDatabase;

    private User $planner;

    private User $office;

    private Strategic $plan;

    private StrategicObjective $objective;

    protected function setUp(): void
    {
        parent::setUp();
        $this->planner = $this->user('Planning Officer', 'Planning Office', ['correct_progress', 'view_progress', 'assign_responsible_unit', 'update', 'create']);
        $this->office = $this->user('Responsible Unit User', 'ICT Office', ['update_progress', 'view_progress']);
        $this->plan = app(PlanCreationService::class)->create(['level' => 'strategic_plan', 'title' => 'Progress plan',
            'mission' => 'Mission', 'vision' => 'Vision', 'core_values' => ['Integrity'], 'status' => 'draft'], $this->planner);
        $this->objective = $this->objective('ICT Office');
    }

    public function test_endpoints_require_authentication(): void
    {
        $this->patchJson($this->url(), ['progress_percentage' => 10])->assertUnauthorized();
        $this->getJson('/api/strategic-objective-progress')->assertUnauthorized();
        $this->getJson($this->historyUrl())->assertUnauthorized();
    }

    public function test_office_can_log_in_load_permissions_and_update_progress_with_its_cookie(): void
    {
        config(['security.trusted_origins' => ['http://localhost']]);
        $this->withHeader('Origin', 'http://localhost');
        $login = $this->postJson('/api/auth/login', ['email' => $this->office->email, 'password' => 'Password123!'])
            ->assertOk()->assertCookie('access_token');
        auth('api')->forgetUser();
        $this->withCredentials()->withUnencryptedCookie('access_token', $login->getCookie('access_token', false)->getValue());
        $profile = $this->getJson('/api/auth/me')->assertOk()->assertJsonPath('data.user_id', $this->office->user_id);
        $this->assertContains('strategic_objectives.update_progress', $profile->json('data.permissions'));
        $this->patchJson($this->url(), ['progress_percentage' => 35])->assertOk();
        $this->office->update(['status' => 'inactive']);
        auth('api')->forgetUser();
        $this->patchJson($this->url(), ['progress_percentage' => 60])->assertUnauthorized();
        $this->assertSame(35, $this->objective->fresh()->progress_percentage);
    }

    public static function percentages(): array
    {
        return [[0, 'not_started'], [1, 'in_progress'], [50, 'in_progress'], [99, 'in_progress'], [100, 'completed']];
    }

    #[DataProvider('percentages')]
    public function test_office_can_persist_progress_and_calculated_status(int $percentage, string $status): void
    {
        $this->authenticateApiUser($this->office);
        $this->patchJson($this->url(), ['progress_percentage' => $percentage])->assertOk()
            ->assertJsonPath('data.progress_percentage', $percentage)->assertJsonPath('data.progress_status', $status);
        $this->assertDatabaseHas('tblstrategic_objectives', ['objective_id' => $this->objective->objective_id,
            'progress_percentage' => $percentage, 'progress_status' => $status, 'progress_updated_by' => $this->office->user_id]);
        $this->assertNotNull($this->objective->fresh()->progress_updated_at);
    }

    public function test_office_cannot_update_another_office_or_an_unassigned_objective(): void
    {
        $other = $this->objective('Research Office');
        $unassigned = $this->objective(null);
        $this->authenticateApiUser($this->office);
        foreach ([$other, $unassigned] as $objective) {
            $this->patchJson($this->url($objective), ['progress_percentage' => 20, 'reason' => 'Not allowed'])->assertForbidden();
        }
        $this->assertDatabaseCount('tblobjective_progress_updates', 0);
    }

    public function test_current_membership_and_active_unit_are_required(): void
    {
        $this->authenticateApiUser($this->office);
        $this->office->update(['office' => 'Research Office']);
        $this->patchJson($this->url(), ['progress_percentage' => 10])->assertForbidden();
        $this->office->update(['office' => 'ICT Office']);
        $this->objective->responsibleUnitAssignment->responsibleUnit->update(['is_active' => false]);
        $this->patchJson($this->url(), ['progress_percentage' => 10])->assertForbidden();
    }

    public function test_planning_corrections_work_across_offices_and_preserve_every_audit(): void
    {
        $this->authenticateApiUser($this->office);
        $this->patchJson($this->url(), ['progress_percentage' => 80])->assertOk();
        $first = ObjectiveProgressUpdate::first()->getAttributes();
        $this->authenticateApiUser($this->planner);
        $this->travel(2)->minutes();
        $this->patchJson($this->url(), ['progress_percentage' => 40, 'reason' => 'Corrected source report'])->assertOk();
        $this->travel(2)->minutes();
        $this->patchJson($this->url(), ['progress_percentage' => 100, 'reason' => 'Completion verified'])->assertOk();
        $this->assertSame($first, ObjectiveProgressUpdate::first()->getAttributes());
        $this->assertDatabaseHas('tblobjective_progress_updates', [
            'objective_id' => $this->objective->objective_id, 'updated_by' => $this->planner->user_id,
            'updater_name' => $this->planner->name, 'updater_role' => 'Planning Officer', 'is_correction' => true,
            'previous_percentage' => 80, 'previous_status' => 'in_progress', 'new_percentage' => 40,
            'new_status' => 'in_progress', 'reason' => 'Corrected source report',
        ]);
        $this->getJson($this->historyUrl().'?per_page=1')->assertOk()->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.last_page', 3)->assertJsonPath('data.0.reason', 'Completion verified')
            ->assertJsonPath('data.0.new_status', 'completed');
        $unassigned = $this->objective(null);
        $this->patchJson($this->url($unassigned), ['progress_percentage' => 10, 'reason' => 'Verified'])->assertOk();
    }

    public function test_planner_must_have_correction_permission_and_cannot_use_office_permission_to_avoid_reason(): void
    {
        $permission = Permission::where('code', 'strategic_objectives.correct_progress')->firstOrFail();
        $this->planner->role->permissions()->detach($permission->permission_id);
        $this->planner->role->permissions()->attach(Permission::where('code', 'strategic_objectives.update_progress')->value('permission_id'));
        $this->planner->update(['office' => 'ICT Office']);
        $this->authenticateApiUser($this->planner);
        $this->patchJson($this->url(), ['progress_percentage' => 25, 'reason' => 'Reason'])->assertForbidden();
    }

    public function test_correction_permission_alone_does_not_make_an_office_user_a_planner(): void
    {
        $this->office->role->permissions()->attach(Permission::where('code', 'strategic_objectives.correct_progress')->value('permission_id'));
        $other = $this->objective('Research Office');
        $this->authenticateApiUser($this->office);
        $this->patchJson($this->url($other), ['progress_percentage' => 50, 'reason' => 'Reason'])->assertForbidden();
    }

    public function test_planner_reason_is_required_even_for_no_change(): void
    {
        $this->authenticateApiUser($this->planner);
        foreach ([[], ['reason' => null], ['reason' => ''], ['reason' => '   ']] as $payload) {
            $this->patchJson($this->url(), ['progress_percentage' => 0, ...$payload])->assertUnprocessable()->assertJsonValidationErrors('reason');
        }
        $this->assertDatabaseCount('tblobjective_progress_updates', 0);
    }

    public function test_invalid_percentages_and_status_overrides_are_rejected_for_both_roles(): void
    {
        foreach ([$this->office, $this->planner] as $actor) {
            $this->authenticateApiUser($actor);
            foreach ([null, -1, 101, 1.5, 'invalid', [], true] as $value) {
                $this->patchJson($this->url(), ['progress_percentage' => $value, 'reason' => 'Reason'])->assertUnprocessable();
            }
            $this->patchJson($this->url(), ['reason' => 'Reason'])->assertUnprocessable();
            foreach (['status', 'progress_status', 'progress_updated_by', 'responsible_office_agency', 'objective_title'] as $field) {
                $this->patchJson($this->url(), ['progress_percentage' => 20, 'reason' => 'Reason', $field => null])
                    ->assertUnprocessable()->assertJsonValidationErrors($field);
            }
        }
        $this->assertDatabaseCount('tblobjective_progress_updates', 0);
    }

    public function test_update_does_not_modify_objective_content_or_assignment_or_other_objectives(): void
    {
        $other = $this->objective('Research Office');
        $beforeOther = $other->fresh()->getAttributes();
        $before = $this->objective->fresh()->getAttributes();
        $assignment = $this->objective->responsibleUnitAssignment->getAttributes();
        $this->authenticateApiUser($this->planner);
        $this->patchJson($this->url(), ['progress_percentage' => 30, 'reason' => 'Verified report'])->assertOk();
        $after = $this->objective->fresh()->getAttributes();
        foreach (['progress_percentage', 'progress_status', 'progress_updated_at', 'progress_updated_by', 'updated_at'] as $key) {
            unset($before[$key], $after[$key]);
        }
        $this->assertSame($before, $after);
        $this->assertSame($assignment, $this->objective->fresh()->responsibleUnitAssignment->getAttributes());
        $this->assertSame($beforeOther, $other->fresh()->getAttributes());
    }

    public function test_planner_can_monitor_all_offices_and_filter_while_office_reads_are_scoped(): void
    {
        $other = $this->objective('Research Office');
        $this->authenticateApiUser($this->planner);
        $this->patchJson($this->url($other), ['progress_percentage' => 100, 'reason' => 'Verified'])->assertOk();
        $this->getJson('/api/strategic-objective-progress')->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson('/api/strategic-objective-progress?progress_status=completed&plan_id='.$this->plan->record_id)
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.objective_id', $other->objective_id);
        $this->authenticateApiUser($this->office);
        $this->getJson('/api/strategic-objective-progress')->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.objective_id', $this->objective->objective_id);
        $this->getJson($this->historyUrl($other))->assertNotFound();
        $viewer = $this->user('Viewer', null, ['view', 'update']);
        $this->authenticateApiUser($viewer);
        $this->getJson('/api/strategic-objective-progress')->assertForbidden();
        $this->getJson($this->historyUrl())->assertForbidden();
        $this->patchJson($this->url(), ['progress_percentage' => 10])->assertForbidden();
    }

    public function test_archived_objectives_remain_readable_but_cannot_be_updated(): void
    {
        $this->objective->update(['status' => 'archived', 'status_before_archive' => 'draft',
            'archived_at' => now(), 'archived_by' => $this->planner->user_id]);
        $this->authenticateApiUser($this->planner);
        $this->patchJson($this->url(), ['progress_percentage' => 10, 'reason' => 'Reason'])->assertUnprocessable();
        $this->getJson($this->historyUrl())->assertOk();
        $this->patchJson('/api/strategic-objectives/999999/progress', ['progress_percentage' => 10, 'reason' => 'Reason'])->assertNotFound();
    }

    public function test_published_objective_in_a_finished_plan_accepts_office_progress(): void
    {
        $this->plan->update(['status' => 'finished']);
        $this->objective->update(['status' => 'published']);
        $this->authenticateApiUser($this->office);
        $this->patchJson($this->url(), ['progress_percentage' => 100])->assertOk()->assertJsonPath('data.progress_status', 'completed');
        $this->assertSame('published', $this->objective->fresh()->status);
        $this->assertSame('finished', $this->plan->fresh()->status);
    }

    public function test_failed_audit_insert_rolls_back_progress(): void
    {
        ObjectiveProgressUpdate::creating(function () {
            throw new \RuntimeException('Audit unavailable');
        });
        try {
            $this->authenticateApiUser($this->planner);
            $this->patchJson($this->url(), ['progress_percentage' => 90, 'reason' => 'Reason'])->assertStatus(500);
            $this->assertSame(0, $this->objective->fresh()->progress_percentage);
            $this->assertNull($this->objective->fresh()->progress_updated_at);
            $this->assertDatabaseCount('tblobjective_progress_updates', 0);
        } finally {
            ObjectiveProgressUpdate::flushEventListeners();
        }
    }

    public function test_generic_objective_api_cannot_bypass_progress_workflow(): void
    {
        $this->authenticateApiUser($this->planner);
        $this->putJson('/api/strategic-objectives/'.$this->objective->objective_id, [
            'progress_percentage' => 100, 'progress_status' => 'completed',
        ])->assertUnprocessable()->assertJsonValidationErrors(['progress_percentage', 'progress_status']);
    }

    public function test_database_rejects_out_of_range_progress_and_generated_status_override(): void
    {
        foreach ([['progress_percentage' => 101], ['progress_status' => 'completed']] as $data) {
            try {
                DB::table('tblstrategic_objectives')->where('objective_id', $this->objective->objective_id)->update($data);
                $this->fail('Database accepted invalid progress.');
            } catch (QueryException $e) {
                $this->assertNotEmpty($e->getMessage());
            }
        }
        $this->assertSame(0, $this->objective->fresh()->progress_percentage);
    }

    public function test_permission_seeding_is_idempotent_and_separates_office_and_planner(): void
    {
        $this->seed(ObjectiveProgressPermissionSeeder::class);
        $this->seed(ObjectiveProgressPermissionSeeder::class);
        $this->assertFalse($this->office->role->permissions->contains('code', 'strategic_objectives.correct_progress'));
        $this->assertTrue($this->planner->role->permissions->contains('code', 'strategic_objectives.correct_progress'));
    }

    public function test_progress_schema_migration_can_be_reversed_and_reapplied(): void
    {
        // MySQL DDL implicitly commits: leave the disposable fixture transaction first.
        DB::rollBack();
        RefreshDatabaseState::$migrated = false;
        $migration = require database_path('migrations/2026_09_21_000001_add_strategic_objective_progress.php');
        $migration->down();
        $this->assertFalse(Schema::hasColumn('tblstrategic_objectives', 'progress_percentage'));
        $this->assertFalse(Schema::hasTable('tblobjective_progress_updates'));
        $migration->up();
        $this->assertTrue(Schema::hasColumn('tblstrategic_objectives', 'progress_status'));
        $this->assertTrue(Schema::hasTable('tblobjective_progress_updates'));
    }

    private function user(string $roleName, ?string $office, array $actions): User
    {
        $role = Role::firstOrCreate(['role_name' => $roleName], ['is_assignable' => true, 'is_protected' => false]);
        foreach ($actions as $action) {
            $code = 'strategic_objectives.'.$action;
            $permission = Permission::firstOrCreate(['code' => $code], ['permission_name' => $code, 'module' => 'strategic_objectives']);
            $role->permissions()->syncWithoutDetaching([$permission->permission_id]);
        }

        return User::create(['first_name' => 'Progress', 'last_name' => $roleName, 'email' => fake()->unique()->safeEmail(),
            'password' => 'Password123!', 'status' => 'active', 'role_id' => $role->role_id, 'office' => $office]);
    }

    private function objective(?string $office): StrategicObjective
    {
        $objective = StrategicObjective::create(['strategic_plan_id' => $this->plan->record_id, 'created_by' => $this->planner->user_id,
            'objective_title' => 'Objective '.($office ?? 'Unassigned'), 'objective_description' => 'Description',
            'expected_outcome' => 'Outcome', 'target' => 'Target', 'status' => 'draft']);
        if ($office) {
            app(ResponsibleUnitService::class)->assign([$objective->objective_id], ['responsible_office_agency' => $office], $this->planner);
        }

        return $objective->refresh();
    }

    private function url(?StrategicObjective $objective = null): string
    {
        return '/api/strategic-objectives/'.($objective ?? $this->objective)->objective_id.'/progress';
    }

    private function historyUrl(?StrategicObjective $objective = null): string
    {
        return '/api/strategic-objectives/'.($objective ?? $this->objective)->objective_id.'/progress-history';
    }
}
