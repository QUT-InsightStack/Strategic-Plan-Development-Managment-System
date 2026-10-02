<?php

namespace Tests\Feature;

use App\Contracts\StrategicLogWriter;
use App\Models\ImplementationInput;
use App\Models\ObjectiveComment;
use App\Models\Permission;
use App\Models\ResponsibleUnit;
use App\Models\Role;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use App\Services\PlanCreationService;
use App\Services\ResponsibleUnitService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ObjectiveCollaborationTest extends TestCase
{
    use RefreshDatabase;

    private User $planner;

    private User $office;

    private Strategic $plan;

    private StrategicObjective $objective;

    protected function setUp(): void
    {
        parent::setUp();
        $this->planner = $this->user([
            'strategic_objectives.view', 'strategic_objectives.create', 'strategic_objectives.update',
            'strategic_objectives.assign_responsible_unit', 'objective_comments.view_all', 'implementation_inputs.view_all',
        ]);
        $this->office = $this->user(['objective_comments.create', 'implementation_inputs.create'], 'ICT Office');
        $this->plan = $this->plan();
        $this->objective = $this->objective($this->plan);
        app(ResponsibleUnitService::class)->assign([$this->objective->objective_id], [
            'responsible_office_agency' => 'ICT Office',
        ], $this->planner);
    }

    public function test_collaboration_endpoints_require_authentication(): void
    {
        $this->postJson($this->commentsUrl(), ['content' => 'Feedback'])->assertUnauthorized();
        $this->postJson($this->inputsUrl(), $this->input())->assertUnauthorized();
        $this->putJson($this->assignmentUrl(), ['responsible_office_agency' => 'ICT Office'])->assertUnauthorized();
        $this->getJson($this->commentsUrl())->assertUnauthorized();
        $this->getJson('/api/responsible-units')->assertUnauthorized();
    }

    public function test_real_jwt_authentication_accepts_active_office_and_rejects_inactive_user(): void
    {
        config(['jwt.secret' => str_repeat('collaboration-test-', 4)]);
        $session = app(\App\Services\AuthSessionService::class)->create($this->office);
        $token = auth('api')->claims(['sid' => $session->id])->login($this->office->refresh());
        auth('api')->forgetUser();
        $this->withToken($token)->postJson($this->inputsUrl(), $this->input())->assertCreated();
        $this->office->update(['status' => 'inactive']);
        auth('api')->forgetUser();
        $this->withToken($token)->postJson($this->inputsUrl(), $this->input())->assertUnauthorized();
        $this->assertDatabaseCount('tblimplementation_inputs', 1);
    }

    public function test_assignment_updates_one_relationship_and_legacy_label_and_is_idempotent(): void
    {
        $this->login($this->planner);
        $this->putJson($this->assignmentUrl(), ['responsible_office_agency' => 'Research Office'])
            ->assertOk()->assertJsonPath('data.responsible_office_agency', 'Research Office');
        $unit = ResponsibleUnit::where('responsible_office_agency', 'Research Office')->firstOrFail();
        $before = DB::table('tblobjective_responsible_units')->first();
        $this->travel(1)->minutes();
        $this->putJson($this->assignmentUrl(), ['responsible_unit_id' => $unit->responsible_unit_id])->assertOk();
        $this->assertDatabaseCount('tblobjective_responsible_units', 1);
        $this->assertDatabaseHas('tblobjective_responsible_units', [
            'objective_id' => $this->objective->objective_id, 'responsible_unit_id' => $unit->responsible_unit_id,
            'assigned_by' => $this->planner->user_id, 'updated_at' => $before->updated_at,
        ]);
    }

    public function test_bulk_assignment_is_atomic_and_validates_units_and_objective_ids(): void
    {
        $second = $this->objective($this->plan);
        $this->login($this->planner);
        $this->putJson('/api/strategic-objectives/responsible-unit', [
            'objective_ids' => [$this->objective->objective_id, $second->objective_id],
            'responsible_office_agency' => 'Research Office',
        ])->assertOk()->assertJsonCount(2, 'data');
        $second->update(['status' => 'archived', 'status_before_archive' => 'draft', 'archived_at' => now(), 'archived_by' => $this->planner->user_id]);
        $this->putJson('/api/strategic-objectives/responsible-unit', [
            'objective_ids' => [$this->objective->objective_id, $second->objective_id],
            'responsible_office_agency' => 'Another Office',
        ])->assertUnprocessable();
        $this->assertSame('Research Office', $this->objective->fresh()->responsible_office_agency);
        $this->putJson($this->assignmentUrl(), ['responsible_unit_id' => 999999])->assertUnprocessable();
        $this->putJson('/api/strategic-objectives/responsible-unit', [
            'objective_ids' => [$this->objective->objective_id, 999999], 'responsible_office_agency' => 'Another Office',
        ])->assertNotFound();
        $this->putJson('/api/strategic-objectives/responsible-unit', [
            'objective_ids' => [$this->objective->objective_id, $this->objective->objective_id], 'responsible_office_agency' => 'Another Office',
        ])->assertUnprocessable();
        $this->putJson($this->assignmentUrl(), ['responsible_office_agency' => '   '])->assertUnprocessable();
    }

    public function test_legacy_objective_endpoints_cannot_bypass_assignment_permission(): void
    {
        $editor = $this->user(['strategic_objectives.create', 'strategic_objectives.update']);
        $this->login($editor);
        $this->putJson($this->assignmentUrl(), ['responsible_office_agency' => 'Untrusted Office'])->assertForbidden();
        $this->putJson('/api/strategic-objectives/'.$this->objective->objective_id, [
            'responsible_office_agency' => 'Untrusted Office', 'objective_title' => 'Changed',
        ])->assertForbidden();
        $this->postJson('/api/strategic-objectives', [
            'strategic_plan_id' => $this->plan->record_id, 'responsible_office_agency' => 'Untrusted Office',
        ])->assertForbidden();
        $this->assertDatabaseMissing('tblresponsible_units', ['responsible_office_agency' => 'Untrusted Office']);
        $this->assertSame('ICT Office', $this->objective->fresh()->responsible_office_agency);
        $this->putJson('/api/strategic-objectives/'.$this->objective->objective_id, [
            'responsible_office_agency' => 'ICT Office', 'objective_title' => 'Allowed edit',
        ])->assertOk();
    }

    public function test_legacy_create_and_update_synchronize_assignment_and_clear_draft_assignment(): void
    {
        $this->login($this->planner);
        $created = $this->postJson('/api/strategic-objectives', [
            'strategic_plan_id' => $this->plan->record_id, 'responsible_office_agency' => 'Research Office',
        ])->assertCreated()->json('data.objective_id');
        $unitId = ResponsibleUnit::where('responsible_office_agency', 'Research Office')->value('responsible_unit_id');
        $this->assertDatabaseHas('tblobjective_responsible_units', ['objective_id' => $created, 'responsible_unit_id' => $unitId]);
        $this->putJson('/api/strategic-objectives/'.$created, ['responsible_office_agency' => 'ICT Office'])->assertOk();
        $this->assertDatabaseMissing('tblobjective_responsible_units', ['objective_id' => $created, 'responsible_unit_id' => $unitId]);
        $this->putJson('/api/strategic-objectives/'.$created, ['responsible_office_agency' => null])->assertOk();
        $this->assertDatabaseMissing('tblobjective_responsible_units', ['objective_id' => $created]);
    }

    public function test_comments_are_appended_and_returned_with_history_and_server_identity(): void
    {
        $this->login($this->office);
        foreach (['First feedback', 'Second feedback'] as $content) {
            $this->postJson($this->commentsUrl(), ['content' => $content])->assertCreated()
                ->assertJsonPath('data.objective_id', $this->objective->objective_id)
                ->assertJsonPath('data.submitted_by', $this->office->user_id)
                ->assertJsonPath('data.responsible_office_agency', 'ICT Office');
        }
        $this->getJson($this->commentsUrl().'?per_page=1&page=2')->assertOk()
            ->assertJsonPath('data.0.content', 'Second feedback')->assertJsonPath('meta.total', 2);
        $this->login($this->planner);
        $this->getJson($this->commentsUrl())->assertOk()->assertJsonCount(2, 'data');
        $this->assertNotNull(ObjectiveComment::first()->submitted_at);
    }

    public function test_comments_and_inputs_reject_invalid_content_and_forged_identity_or_status(): void
    {
        $this->login($this->office);
        foreach (['', '  ', ['invalid'], str_repeat('x', 20001)] as $content) {
            $this->postJson($this->commentsUrl(), ['content' => $content])->assertUnprocessable();
            $this->postJson($this->inputsUrl(), ['content' => $content, 'input_type' => 'progress_update'])->assertUnprocessable();
        }
        foreach (['submitted_by' => $this->planner->user_id, 'submitted_at' => '2000-01-01',
            'responsible_office_agency' => 'Another Office', 'responsible_unit_id' => 1,
            'review_status' => 'Approved', 'status' => 'Approved', 'strategic_plan_id' => 999] as $field => $value) {
            $this->postJson($this->commentsUrl(), ['content' => 'Feedback', $field => $value])->assertUnprocessable();
            $this->postJson($this->inputsUrl(), [...$this->input(), $field => $value])->assertUnprocessable();
        }
        $this->postJson($this->inputsUrl(), ['content' => 'Feedback', 'input_type' => 'invalid'])->assertUnprocessable();
        $this->assertDatabaseCount('tblobjective_comments', 0);
        $this->assertDatabaseCount('tblimplementation_inputs', 0);
    }

    public function test_other_offices_and_users_without_permissions_cannot_write_or_read_feedback(): void
    {
        foreach ([$this->user(['objective_comments.create', 'implementation_inputs.create'], 'Other Office'),
            $this->user([], 'ICT Office')] as $user) {
            $this->login($user);
            $this->postJson($this->commentsUrl(), ['content' => 'Feedback'])->assertForbidden();
            $this->postJson($this->inputsUrl(), $this->input())->assertForbidden();
            $this->getJson($this->commentsUrl())->assertForbidden();
            $this->getJson($this->inputsUrl())->assertForbidden();
        }
        $this->login($this->office);
        $this->putJson('/api/auth/profile', ['office' => 'Other Office'])->assertUnprocessable();
    }

    public function test_reassignment_revokes_old_office_access_and_retains_feedback_for_planners(): void
    {
        $this->login($this->office);
        $this->postJson($this->commentsUrl(), ['content' => 'Original office feedback'])->assertCreated();
        $this->postJson($this->inputsUrl(), $this->input())->assertCreated();
        $this->login($this->planner);
        $this->putJson($this->assignmentUrl(), ['responsible_office_agency' => 'Research Office'])->assertOk();
        $this->login($this->office);
        $this->postJson($this->commentsUrl(), ['content' => 'No longer assigned'])->assertForbidden();
        $this->postJson($this->inputsUrl(), $this->input())->assertForbidden();
        $this->getJson($this->commentsUrl())->assertForbidden();
        $this->login($this->user(['objective_comments.create', 'implementation_inputs.create'], 'Research Office'));
        $this->getJson($this->commentsUrl())->assertOk()->assertJsonCount(0, 'data');
        $this->postJson($this->commentsUrl(), ['content' => 'New office feedback'])->assertCreated();
        $this->login($this->planner);
        $this->getJson($this->commentsUrl())->assertOk()->assertJsonCount(2, 'data');
        $this->getJson($this->inputsUrl())->assertOk()->assertJsonPath('data.0.responsible_office_agency', 'ICT Office');
    }

    public function test_inputs_are_pending_and_do_not_modify_plans_objectives_or_references(): void
    {
        $tables = ['tblstrategic_record', 'tblstrategic_objectives', 'tblstrategic_foundations', 'tblpdp_chapters', 'tblrelation_map'];
        $before = collect($tables)->mapWithKeys(fn ($table) => [$table => DB::table($table)->get()->toJson()]);
        $this->login($this->office);
        $this->postJson($this->inputsUrl(), $this->input())->assertCreated()
            ->assertJsonPath('data.review_status', 'Pending Review')
            ->assertJsonPath('data.strategic_plan_id', $this->plan->record_id)
            ->assertJsonPath('data.objective_id', $this->objective->objective_id)
            ->assertJsonPath('data.input_type', 'progress_update')
            ->assertJsonPath('data.submitted_by', $this->office->user_id);
        foreach ($before as $table => $snapshot) {
            $this->assertSame($snapshot, DB::table($table)->get()->toJson(), $table.' was modified');
        }
        $this->assertNotNull(ImplementationInput::first()->submitted_at);
    }

    public function test_plan_inputs_allow_optional_objective_and_reject_cross_plan_links(): void
    {
        $otherPlan = $this->plan();
        $otherObjective = $this->objective($otherPlan);
        $this->login($this->office);
        $url = '/api/strategic-plans/'.$this->plan->record_id.'/inputs';
        $this->postJson($url, $this->input())->assertCreated()->assertJsonPath('data.objective_id', null);
        $this->postJson($url, [...$this->input(), 'objective_id' => $this->objective->objective_id])->assertCreated();
        $this->postJson($url, [...$this->input(), 'objective_id' => $otherObjective->objective_id])->assertUnprocessable();
        $this->postJson('/api/strategic-plans/'.$otherPlan->record_id.'/inputs', $this->input())->assertForbidden();
        $this->getJson($url)->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_office_can_propose_an_objective_for_an_unassigned_draft_plan_without_gaining_objective_input_access(): void
    {
        $otherPlan = $this->plan();
        $otherObjective = $this->objective($otherPlan);
        $this->office->role->update(['role_name' => 'Office']);
        $this->login($this->office);
        $url = '/api/strategic-plans/'.$otherPlan->record_id.'/inputs';

        $this->postJson($url, $this->input('change_request'))
            ->assertCreated()->assertJsonPath('data.objective_id', null);
        $this->getJson($url)->assertOk()->assertJsonCount(1, 'data');
        $this->postJson($url, $this->input('progress_update'))->assertForbidden();
        $this->postJson('/api/strategic-objectives/'.$otherObjective->objective_id.'/inputs', $this->input('change_request'))
            ->assertForbidden();
    }

    public function test_finalized_content_accepts_progress_but_rejects_change_requests(): void
    {
        $this->login($this->office);
        $this->postJson($this->inputsUrl(), $this->input('change_request'))->assertCreated();
        $this->objective->update(['status' => 'published']);
        $this->postJson($this->inputsUrl(), $this->input('change_request'))->assertUnprocessable();
        $this->postJson($this->inputsUrl(), $this->input())->assertCreated();
        $this->objective->update(['status' => 'draft']);
        $this->plan->update(['status' => 'finished']);
        $this->postJson($this->inputsUrl(), $this->input('change_request'))->assertUnprocessable();
        $this->postJson('/api/strategic-plans/'.$this->plan->record_id.'/inputs', $this->input('change_request'))->assertUnprocessable();
        $this->postJson($this->inputsUrl(), $this->input('issue'))->assertCreated();
    }

    public function test_archived_and_deleted_content_reject_new_feedback_without_losing_history(): void
    {
        $this->login($this->office);
        $this->postJson($this->commentsUrl(), ['content' => 'Retained'])->assertCreated();
        $this->postJson($this->inputsUrl(), $this->input())->assertCreated();
        $this->plan->update(['status' => 'finished']);
        $this->plan->update(['status' => 'archived', 'archived_at' => now(), 'archived_by' => $this->planner->user_id]);
        $this->postJson($this->commentsUrl(), ['content' => 'Closed'])->assertUnprocessable();
        $this->postJson($this->inputsUrl(), $this->input())->assertUnprocessable();
        $this->getJson($this->commentsUrl())->assertOk()->assertJsonCount(1, 'data');
        $this->plan->update(['status' => 'deleted', 'deleted_at' => now(), 'archived_at' => null, 'archived_by' => null]);
        $this->postJson($this->inputsUrl(), $this->input())->assertNotFound();
        $this->assertDatabaseCount('tblobjective_comments', 1);
        $this->assertDatabaseCount('tblimplementation_inputs', 1);
    }

    public function test_database_enforces_plan_objective_pair_and_preserves_history_on_user_deletion(): void
    {
        $this->login($this->office);
        $this->postJson($this->inputsUrl(), $this->input())->assertCreated();
        $this->postJson($this->commentsUrl(), ['content' => 'Keep me'])->assertCreated();
        $otherPlan = $this->plan();
        try {
            DB::table('tblimplementation_inputs')->where('input_id', ImplementationInput::first()->input_id)
                ->update(['strategic_plan_id' => $otherPlan->record_id]);
            $this->fail('The database accepted an objective linked to the wrong plan.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString('FOREIGN KEY', $exception->getMessage());
        }
        $this->office->delete();
        $this->assertNull(ObjectiveComment::first()->submitted_by);
        $this->assertNull(ImplementationInput::first()->submitted_by);
        $this->assertSame('ICT Office', ImplementationInput::first()->responsible_office_agency);
    }

    public function test_audit_failure_rolls_back_submission(): void
    {
        $this->login($this->office);
        $this->mock(StrategicLogWriter::class, function ($mock) {
            $mock->shouldReceive('write')->once()->andThrow(new \RuntimeException('Audit failed'));
        });
        $this->postJson($this->inputsUrl(), $this->input())->assertStatus(500);
        $this->assertDatabaseCount('tblimplementation_inputs', 0);
    }

    public function test_inactive_units_and_changed_office_membership_revoke_access(): void
    {
        $this->login($this->office);
        $this->office->update(['office' => 'Research Office']);
        $this->postJson($this->commentsUrl(), ['content' => 'No longer in office'])->assertForbidden();
        $this->postJson($this->inputsUrl(), $this->input())->assertForbidden();
        $this->office->update(['office' => '  ict office  ']);
        $this->postJson($this->commentsUrl(), ['content' => 'Case normalized'])->assertCreated();
        ResponsibleUnit::query()->update(['is_active' => false]);
        $this->postJson($this->inputsUrl(), $this->input())->assertForbidden();
        $this->login($this->planner);
        $this->getJson('/api/responsible-units')->assertOk()->assertJsonCount(0, 'data');
        $this->putJson($this->assignmentUrl(), ['responsible_office_agency' => 'ICT Office'])->assertUnprocessable();
    }

    public function test_archived_objective_rejects_submissions_and_history_has_no_mutation_routes(): void
    {
        $this->login($this->office);
        $commentId = $this->postJson($this->commentsUrl(), ['content' => '<script>literal text</script>'])
            ->assertCreated()->json('data.comment_id');
        $inputId = $this->postJson($this->inputsUrl(), $this->input())->assertCreated()->json('data.input_id');
        $this->objective->update(['status' => 'archived', 'status_before_archive' => 'draft', 'archived_at' => now(), 'archived_by' => $this->planner->user_id]);
        $this->postJson($this->commentsUrl(), ['content' => 'Closed'])->assertUnprocessable();
        $this->postJson($this->inputsUrl(), $this->input())->assertUnprocessable();
        $this->getJson($this->commentsUrl())->assertOk()->assertJsonPath('data.0.content', '<script>literal text</script>');
        $this->putJson($this->commentsUrl().'/'.$commentId, ['content' => 'Rewritten'])->assertNotFound();
        $this->deleteJson($this->commentsUrl().'/'.$commentId)->assertNotFound();
        $this->putJson($this->inputsUrl().'/'.$inputId, ['review_status' => 'Approved'])->assertNotFound();
        $this->deleteJson($this->inputsUrl().'/'.$inputId)->assertNotFound();
        $this->assertSame('Pending Review', ImplementationInput::first()->review_status);
    }

    public function test_database_supplies_pending_review_default_and_restricts_history_deletion(): void
    {
        $this->login($this->office);
        $this->postJson($this->inputsUrl(), $this->input())->assertCreated();
        $record = ImplementationInput::first()->getAttributes();
        unset($record['input_id'], $record['review_status']);
        $id = DB::table('tblimplementation_inputs')->insertGetId($record, 'input_id');
        $this->assertDatabaseHas('tblimplementation_inputs', ['input_id' => $id, 'review_status' => 'Pending Review']);
        try {
            $this->objective->delete();
            $this->fail('An objective with implementation history was physically deleted.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString('FOREIGN KEY', $exception->getMessage());
        }
        $this->assertDatabaseCount('tblimplementation_inputs', 2);
    }

    public function test_plan_history_does_not_leak_other_offices_inputs_and_validates_pagination(): void
    {
        $second = $this->objective($this->plan);
        app(ResponsibleUnitService::class)->assign([$second->objective_id], ['responsible_office_agency' => 'Research Office'], $this->planner);
        $this->login($this->user(['implementation_inputs.create'], 'Research Office'));
        $this->postJson('/api/strategic-objectives/'.$second->objective_id.'/inputs', $this->input())->assertCreated();
        $this->login($this->office);
        $url = '/api/strategic-plans/'.$this->plan->record_id.'/inputs';
        $this->getJson($url)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($url.'?per_page=10000')->assertUnprocessable();
        $this->getJson($this->commentsUrl().'?page=0')->assertUnprocessable();
        $this->login($this->planner);
        $this->getJson($url)->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_upgrade_backfills_existing_labels_and_supports_rollback(): void
    {
        // MySQL DDL implicitly commits. End the outer test transaction, rebuild
        // the required fixtures, and force a fresh schema for the next test.
        DB::rollBack();
        \Illuminate\Foundation\Testing\RefreshDatabaseState::$migrated = false;
        $this->planner = $this->user(['strategic_objectives.assign_responsible_unit']);
        $this->office = $this->user(['objective_comments.create'], 'ICT Office');
        $this->plan = $this->plan();
        $this->objective = $this->objective($this->plan);
        $this->objective->update(['responsible_office_agency' => 'ICT Office']);
        $migration = require database_path('migrations/2026_09_14_000001_create_objective_collaboration_tables.php');
        $migration->down();
        $this->assertFalse(Schema::hasTable('tblobjective_comments'));
        $migration->up();
        $this->assertDatabaseHas('tblobjective_responsible_units', ['objective_id' => $this->objective->objective_id]);
        $this->assertDatabaseCount('tblresponsible_units', 1);
        $this->login($this->office);
        $this->postJson($this->commentsUrl(), ['content' => 'Migrated office'])->assertCreated();
    }

    public function test_seeders_provision_planner_and_office_permissions_idempotently(): void
    {
        // Legacy collaboration roles remain supported, but are no longer defaults.
        Role::create(['role_name' => 'Responsible Unit User']);
        $this->seed([RolesSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        $this->seed(RolePermissionSeeder::class);
        $planner = Role::where('role_name', 'Planning Officer')->firstOrFail();
        $office = Role::where('role_name', 'Responsible Unit User')->firstOrFail();
        $this->assertTrue($planner->permissions->contains('code', 'strategic_objectives.assign_responsible_unit'));
        $this->assertTrue($planner->permissions->contains('code', 'implementation_inputs.view_all'));
        $this->assertTrue($office->permissions->contains('code', 'implementation_inputs.create'));
        $this->assertFalse($office->permissions->contains('code', 'strategic_objectives.assign_responsible_unit'));
    }

    private function login(User $user): void
    {
        $this->authenticateApiUser($user);
    }

    private function user(array $codes, ?string $office = null): User
    {
        $role = Role::create(['role_name' => 'Role '.fake()->unique()->uuid(), 'is_assignable' => true, 'is_protected' => false]);
        foreach ($codes as $code) {
            $permission = Permission::firstOrCreate(['code' => $code], ['permission_name' => $code, 'module' => explode('.', $code)[0]]);
            $role->permissions()->attach($permission->permission_id);
        }

        return User::create(['first_name' => 'Office', 'last_name' => 'User', 'email' => fake()->unique()->safeEmail(),
            'password' => 'Password123!', 'status' => 'active', 'role_id' => $role->role_id, 'office' => $office]);
    }

    private function plan(): Strategic
    {
        $plan = app(PlanCreationService::class)->create(['level' => 'strategic_plan', 'title' => 'Test plan',
            'mission' => 'Mission', 'vision' => 'Vision', 'core_values' => ['Integrity'], 'status' => 'draft'], $this->planner);
        DB::table('tblimplementation_input_scopes')->insert([
            'strategic_plan_id' => $plan->record_id, 'user_id' => $this->planner->user_id,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return $plan;
    }

    private function objective(Strategic $plan): StrategicObjective
    {
        return StrategicObjective::create(['strategic_plan_id' => $plan->record_id, 'created_by' => $this->planner->user_id,
            'objective_title' => 'Objective', 'objective_description' => 'Description', 'expected_outcome' => 'Outcome',
            'target' => 'Target', 'status' => 'draft']);
    }

    private function commentsUrl(): string
    {
        return '/api/strategic-objectives/'.$this->objective->objective_id.'/comments';
    }

    private function inputsUrl(): string
    {
        return '/api/strategic-objectives/'.$this->objective->objective_id.'/inputs';
    }

    private function assignmentUrl(): string
    {
        return '/api/strategic-objectives/'.$this->objective->objective_id.'/responsible-unit';
    }

    private function input(string $type = 'progress_update'): array
    {
        return ['content' => 'Implementation feedback', 'input_type' => $type];
    }
}
