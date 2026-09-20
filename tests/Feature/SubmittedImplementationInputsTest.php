<?php

namespace Tests\Feature;

use App\Contracts\StrategicLogWriter;
use App\Models\ImplementationInput;
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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SubmittedImplementationInputsTest extends TestCase
{
    use RefreshDatabase;

    private User $planner;

    private User $office;

    private User $otherOffice;

    private Strategic $plan;

    private Strategic $outsidePlan;

    private StrategicObjective $objective;

    private StrategicObjective $otherObjective;

    private ImplementationInput $pending;

    private ImplementationInput $approved;

    private ImplementationInput $rejected;

    private ImplementationInput $outside;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        $this->planner = $this->user('Planning Officer');
        $this->office = $this->user('Responsible Unit User', 'ICT Office');
        $this->otherOffice = $this->user('Responsible Unit User', 'Research Office');
        $this->plan = $this->plan('Authorized plan');
        $this->outsidePlan = $this->plan('Outside plan');
        $this->objective = $this->objective($this->plan, 'ICT Office');
        $this->otherObjective = $this->objective($this->plan, 'Research Office');
        $outsideObjective = $this->objective($this->outsidePlan, 'Research Office');
        $this->grant($this->planner, $this->plan);
        $this->pending = $this->input($this->objective, $this->office, 'Pending Review', 'progress_update');
        $this->approved = $this->input($this->objective, $this->office, 'Approved', 'issue');
        $this->rejected = $this->input($this->otherObjective, $this->otherOffice, 'Rejected', 'change_request');
        $this->outside = $this->input($outsideObjective, $this->otherOffice, 'Pending Review', 'progress_update');
    }

    public function test_authentication_and_view_permission_are_required_on_every_read_route(): void
    {
        $urls = ['/api/implementation-inputs', '/api/implementation-inputs/'.$this->pending->input_id,
            '/api/strategic-plans/'.$this->plan->record_id.'/inputs', '/api/strategic-objectives/'.$this->objective->objective_id.'/inputs'];
        foreach ($urls as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
        $this->authenticateApiUser($this->user('Viewer'));
        foreach ($urls as $url) {
            $this->getJson($url)->assertForbidden();
        }
    }

    public function test_planner_lists_only_explicitly_authorized_plans_with_scoped_metadata(): void
    {
        $this->authenticateApiUser($this->planner);
        $this->getJson('/api/implementation-inputs?per_page=1')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.input_id', $this->pending->input_id)
            ->assertJsonPath('data.0.can_review', true)
            ->assertJsonPath('meta.total', 3)->assertJsonPath('meta.last_page', 3)
            ->assertJsonPath('meta.summary', ['Pending Review' => 1, 'Approved' => 1, 'Rejected' => 1])
            ->assertJsonCount(1, 'meta.filters.plans')->assertJsonCount(2, 'meta.filters.offices')
            ->assertJsonMissing(['title' => 'Outside plan']);
        $this->getJson('/api/implementation-inputs?per_page=1&page=2')->assertOk()
            ->assertJsonPath('data.0.input_id', $this->approved->input_id)->assertJsonPath('data.0.can_review', false);
        $this->getJson('/api/implementation-inputs?page=20')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.total', 3);
    }

    public function test_missing_scope_does_not_infer_access_from_plan_ownership_or_department(): void
    {
        DB::table('tblimplementation_input_scopes')->delete();
        $this->authenticateApiUser($this->planner);
        $this->getJson('/api/implementation-inputs')->assertOk()->assertJsonCount(0, 'data')
            ->assertJsonPath('meta.summary', ['Pending Review' => 0, 'Approved' => 0, 'Rejected' => 0])
            ->assertJsonCount(0, 'meta.filters.plans')->assertJsonCount(0, 'meta.filters.offices');
        $this->getJson('/api/strategic-plans/'.$this->plan->record_id.'/inputs')->assertForbidden();
    }

    public function test_out_of_scope_plan_objective_detail_and_review_requests_are_rejected(): void
    {
        $this->authenticateApiUser($this->planner);
        foreach (['/api/implementation-inputs?plan_id='.$this->outsidePlan->record_id,
            '/api/strategic-plans/'.$this->outsidePlan->record_id.'/inputs',
            '/api/strategic-objectives/'.$this->outside->objective_id.'/inputs',
            '/api/implementation-inputs?objective_id='.$this->outside->objective_id,
            '/api/implementation-inputs/'.$this->outside->input_id] as $url) {
            $this->getJson($url)->assertForbidden();
        }
        $this->postJson('/api/implementation-inputs/'.$this->outside->input_id.'/review', ['status' => 'Approved'])->assertForbidden();
        $this->assertSame('Pending Review', $this->outside->fresh()->review_status);
    }

    public function test_office_reads_all_its_office_users_inputs_and_cannot_expand_scope(): void
    {
        $colleague = $this->user('Responsible Unit User', '  ict office  ');
        $this->authenticateApiUser($colleague);
        $this->getJson('/api/implementation-inputs')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.submitted_by', $this->office->user_id)->assertJsonPath('data.0.can_review', false)
            ->assertJsonPath('meta.summary', ['Pending Review' => 1, 'Approved' => 1, 'Rejected' => 0])
            ->assertJsonCount(1, 'meta.filters.offices');
        foreach (['/api/implementation-inputs/'.$this->rejected->input_id,
            '/api/implementation-inputs?responsible_unit_id='.$this->rejected->responsible_unit_id,
            '/api/strategic-objectives/'.$this->otherObjective->objective_id.'/inputs'] as $url) {
            $this->getJson($url)->assertForbidden();
        }
        $this->getJson('/api/implementation-inputs?created_by='.$this->otherOffice->user_id.'&office=Research%20Office')
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonMissing(['input_id' => $this->rejected->input_id]);
    }

    public function test_office_role_cannot_bypass_own_office_scope_with_extra_read_all_or_review_permissions(): void
    {
        $this->office->role->permissions()->syncWithoutDetaching(Permission::whereIn('code', ['implementation_inputs.view_all', 'implementation_inputs.review'])->pluck('permission_id'));
        $this->grant($this->office, $this->outsidePlan);
        $this->authenticateApiUser($this->office);
        $this->getJson('/api/implementation-inputs')->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('data.0.can_review', false);
        $this->postJson($this->reviewUrl(), ['status' => 'Approved'])->assertForbidden();
    }

    public function test_filters_and_summary_apply_scope_before_status_and_pagination(): void
    {
        $this->authenticateApiUser($this->planner);
        $this->getJson('/api/implementation-inputs?responsible_unit_id='.$this->pending->responsible_unit_id.'&status=Approved&per_page=1')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.input_id', $this->approved->input_id)
            ->assertJsonPath('meta.total', 1)->assertJsonPath('meta.summary', ['Pending Review' => 1, 'Approved' => 1, 'Rejected' => 0]);
        $this->getJson('/api/implementation-inputs?input_type=issue&submitted_from=2026-09-01&submitted_to=2026-09-01')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('meta.summary.Approved', 1);
        $this->getJson('/api/implementation-inputs?submitted_from=2026-09-02')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/implementation-inputs?objective_id='.$this->objective->objective_id)->assertOk()->assertJsonPath('meta.total', 2);
    }

    public function test_invalid_filters_and_conflicting_route_identifiers_are_rejected(): void
    {
        $this->authenticateApiUser($this->planner);
        foreach (['status=Invalid', 'input_type=objective', 'per_page=101', 'page=0', 'plan_id[]=1',
            'submitted_from=invalid', 'submitted_from=2026-09-02&submitted_to=2026-09-01', 'responsible_unit_id=-1'] as $query) {
            $this->getJson('/api/implementation-inputs?'.$query)->assertUnprocessable();
        }
        $this->getJson('/api/strategic-plans/'.$this->plan->record_id.'/inputs?plan_id='.$this->outsidePlan->record_id)->assertUnprocessable();
        $this->grant($this->planner, $this->outsidePlan);
        $this->getJson('/api/implementation-inputs?plan_id='.$this->plan->record_id.'&objective_id='.$this->outside->objective_id)->assertUnprocessable();
        $this->getJson('/api/implementation-inputs/99999999')->assertNotFound();
    }

    public function test_record_provenance_matches_database_and_survives_submitter_deletion(): void
    {
        $this->authenticateApiUser($this->planner);
        $this->office->delete();
        $data = $this->getJson('/api/implementation-inputs/'.$this->pending->input_id)->assertOk()->json('data');
        $input = $this->pending->fresh();
        foreach (['input_id', 'strategic_plan_id', 'objective_id', 'responsible_unit_id', 'submitted_by',
            'responsible_office_agency', 'submitter_name', 'input_type', 'review_status', 'submitted_at', 'content'] as $field) {
            $this->assertSame($input->toArray()[$field], $data[$field], $field);
        }
        $this->assertNull($data['submitted_by']);
        $this->assertSame($this->office->name, $data['submitter_name']);
        $this->assertSame($this->plan->record_id, $data['strategic_plan']['record_id']);
        $this->assertSame($this->objective->objective_id, $data['objective']['objective_id']);
        $this->assertSame($input->responsible_unit_id, $input->submittingUnit->responsible_unit_id);
        $this->assertNull($input->submitter);
    }

    public function test_successful_and_denied_reads_do_not_write_any_database_records(): void
    {
        $this->authenticateApiUser($this->planner);
        $before = $this->snapshot();
        $this->travel(1)->minutes();
        $queries = [];
        DB::listen(function ($query) use (&$queries) {
            $queries[] = $query->sql;
        });
        foreach (['/api/implementation-inputs', '/api/implementation-inputs/'.$this->pending->input_id,
            '/api/strategic-plans/'.$this->plan->record_id.'/inputs', '/api/strategic-objectives/'.$this->objective->objective_id.'/inputs'] as $url) {
            $this->getJson($url)->assertOk();
        }
        $this->getJson('/api/implementation-inputs/'.$this->outside->input_id)->assertForbidden();
        $this->assertSame($before, $this->snapshot());
        foreach ($queries as $sql) {
            $this->assertDoesNotMatchRegularExpression('/^\s*(insert|update|delete|replace|alter)\b/i', $sql);
        }
    }

    public function test_expired_sessions_are_rejected_without_writes_from_read_endpoints(): void
    {
        $this->authenticateApiUser($this->planner);
        DB::table('tblauth_sessions')->update(['expires_at' => now()->subMinute()]);
        $before = $this->snapshot();
        $this->getJson('/api/implementation-inputs')->assertUnauthorized();
        $this->assertSame($before, $this->snapshot());
    }

    public function test_only_authorized_planning_officers_can_review_and_decisions_preserve_submission(): void
    {
        $before = $this->pending->getAttributes();
        $planBefore = $this->plan->fresh()->getAttributes();
        $objectiveBefore = $this->objective->fresh()->getAttributes();
        $this->authenticateApiUser($this->user('Administrator'));
        $this->getJson('/api/implementation-inputs')->assertOk()->assertJsonPath('meta.total', 4)->assertJsonPath('data.0.can_review', false);
        $this->postJson($this->reviewUrl(), ['status' => 'Approved'])->assertForbidden();
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->reviewUrl(), ['status' => 'Approved', 'review_note' => 'Progress verified.'])->assertOk()
            ->assertJsonPath('data.reviewed_by', $this->planner->user_id)->assertJsonPath('data.can_review', false);
        $after = $this->pending->fresh()->getAttributes();
        foreach (array_diff(array_keys($before), ['review_status', 'reviewed_by', 'reviewer_name', 'reviewed_at', 'review_note']) as $field) {
            $this->assertSame($before[$field], $after[$field], $field);
        }
        $this->assertSame($planBefore, $this->plan->fresh()->getAttributes());
        $this->assertSame($objectiveBefore, $this->objective->fresh()->getAttributes());
        $this->assertDatabaseHas('tbllog', ['operation' => 'implementation_input.reviewed', 'resource_id' => $this->pending->input_id]);
        $this->postJson($this->reviewUrl(), ['status' => 'Rejected', 'review_note' => 'Stale review'])->assertConflict();
        $this->assertSame('Approved', $this->pending->fresh()->review_status);
    }

    public function test_reviewer_permission_revocation_and_forged_review_fields_are_rejected(): void
    {
        $this->authenticateApiUser($this->planner);
        foreach ([['status' => 'Rejected'], ['status' => 'Pending Review'], ['status' => 'Approved', 'content' => 'Replaced'],
            ['status' => 'Approved', 'reviewed_by' => $this->otherOffice->user_id]] as $data) {
            $this->postJson($this->reviewUrl(), $data)->assertUnprocessable();
        }
        $this->planner->role->permissions()->detach(Permission::where('code', 'implementation_inputs.review')->value('permission_id'));
        $this->authenticateApiUser($this->planner);
        $this->getJson('/api/implementation-inputs')->assertOk()->assertJsonPath('data.0.can_review', false);
        $this->postJson($this->reviewUrl(), ['status' => 'Approved'])->assertForbidden();
    }

    public function test_review_audit_failure_rolls_back_the_decision(): void
    {
        $this->authenticateApiUser($this->planner);
        $this->mock(StrategicLogWriter::class, function ($mock) {
            $mock->shouldReceive('write')->once()->andThrow(new \RuntimeException('Audit unavailable'));
        });
        $before = $this->pending->fresh()->getAttributes();
        $this->postJson($this->reviewUrl(), ['status' => 'Approved'])->assertStatus(500);
        $this->assertSame($before, $this->pending->fresh()->getAttributes());
    }

    public function test_archived_inputs_remain_visible_but_cannot_be_reviewed_and_deleted_objectives_are_hidden(): void
    {
        $this->objective->update(['status' => 'archived', 'status_before_archive' => 'draft', 'archived_at' => now(), 'archived_by' => $this->planner->user_id]);
        $this->authenticateApiUser($this->planner);
        $this->getJson('/api/implementation-inputs')->assertOk()->assertJsonPath('meta.total', 3)->assertJsonPath('data.0.can_review', false);
        $this->postJson($this->reviewUrl(), ['status' => 'Approved'])->assertConflict();
        $this->objective->update(['status' => 'deleted', 'deleted_at' => now(), 'status_before_archive' => null, 'archived_at' => null, 'archived_by' => null]);
        $this->getJson('/api/implementation-inputs')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/strategic-objectives/'.$this->objective->objective_id.'/inputs')->assertNotFound();
    }

    public function test_office_reassignment_and_inactive_membership_revoke_read_access(): void
    {
        app(ResponsibleUnitService::class)->assign([$this->objective->objective_id], ['responsible_office_agency' => 'Research Office'], $this->planner);
        $this->authenticateApiUser($this->office);
        $this->getJson('/api/implementation-inputs')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/api/implementation-inputs/'.$this->pending->input_id)->assertForbidden();
        $this->authenticateApiUser($this->otherOffice);
        $this->getJson('/api/implementation-inputs')->assertOk()->assertJsonPath('meta.total', 2)->assertJsonMissing(['input_id' => $this->pending->input_id]);
        ResponsibleUnit::whereKey($this->rejected->responsible_unit_id)->update(['is_active' => false]);
        $this->getJson('/api/implementation-inputs')->assertForbidden();
    }

    public function test_administrator_manages_scope_idempotently_and_revocation_applies_immediately(): void
    {
        $url = '/api/strategic-plans/'.$this->plan->record_id.'/input-scope';
        $this->authenticateApiUser($this->planner);
        $this->putJson($url, ['user_ids' => [$this->planner->user_id]])->assertForbidden();
        $this->getJson($url)->assertForbidden();
        $admin = $this->user('Administrator');
        $this->authenticateApiUser($admin);
        $this->putJson($url, ['user_ids' => [$this->office->user_id]])->assertUnprocessable();
        $this->putJson($url, ['user_ids' => []])->assertOk()->assertExactJson(['success' => true, 'data' => []]);
        $this->authenticateApiUser($this->planner);
        $this->getJson('/api/implementation-inputs')->assertOk()->assertJsonPath('meta.total', 0);
        $this->postJson($this->reviewUrl(), ['status' => 'Approved'])->assertForbidden();
        $this->authenticateApiUser($admin);
        $this->putJson($url, ['user_ids' => [$this->planner->user_id]])->assertOk();
        $before = DB::table('tblimplementation_input_scopes')->get()->toJson();
        $logCount = DB::table('tbllog')->count();
        $this->putJson($url, ['user_ids' => [$this->planner->user_id]])->assertOk();
        $this->assertSame($before, DB::table('tblimplementation_input_scopes')->get()->toJson());
        $this->assertSame($logCount, DB::table('tbllog')->count());
        $this->getJson($url)->assertOk()->assertJsonPath('data', [$this->planner->user_id]);
        $this->authenticateApiUser($this->planner);
        $this->getJson('/api/implementation-inputs')->assertOk()->assertJsonPath('meta.total', 3);
    }

    public function test_normal_authenticated_requests_still_update_activity_and_revoke_expired_sessions(): void
    {
        $this->authenticateApiUser($this->planner);
        $before = DB::table('tblauth_sessions')->value('last_activity_at');
        $this->travel(1)->minutes();
        $this->getJson('/api/strategic-plans?read_only=true')->assertOk();
        $this->assertNotSame($before, DB::table('tblauth_sessions')->value('last_activity_at'));
        $this->assertSame(now()->toDateTimeString(), $this->planner->fresh()->last_activity_at->toDateTimeString());
        DB::table('tblauth_sessions')->update(['expires_at' => now()->subMinute()]);
        $this->getJson('/api/strategic-plans')->assertUnauthorized();
        $this->assertNotNull(DB::table('tblauth_sessions')->value('revoked_at'));
    }

    public function test_custom_viewer_cannot_review_and_planner_scope_never_falls_back_to_office_membership(): void
    {
        $role = Role::create(['role_name' => 'Input auditor', 'is_assignable' => true, 'is_protected' => false]);
        $role->permissions()->attach(Permission::whereIn('code', ['implementation_inputs.view_all', 'implementation_inputs.review'])->pluck('permission_id'));
        $auditor = $this->user('Input auditor');
        $this->grant($auditor, $this->plan);
        $this->authenticateApiUser($auditor);
        $this->getJson('/api/implementation-inputs')->assertOk()->assertJsonPath('meta.total', 3)->assertJsonPath('data.0.can_review', false);
        $this->postJson($this->reviewUrl(), ['status' => 'Approved'])->assertForbidden();
        $this->planner->update(['office' => 'Research Office']);
        $this->planner->role->permissions()->detach(Permission::where('code', 'implementation_inputs.view_all')->value('permission_id'));
        $this->authenticateApiUser($this->planner);
        $this->getJson('/api/implementation-inputs')->assertOk()->assertJsonPath('meta.total', 3)->assertJsonMissing(['input_id' => $this->outside->input_id]);
        $this->getJson('/api/strategic-plans/'.$this->outsidePlan->record_id.'/inputs')->assertForbidden();
    }

    public function test_scope_and_review_migration_preserves_inputs_and_provisions_existing_roles(): void
    {
        DB::rollBack();
        RefreshDatabaseState::$migrated = false;
        $this->seed([RolesSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        $this->planner = $this->user('Planning Officer');
        $this->office = $this->user('Responsible Unit User', 'ICT Office');
        $this->plan = $this->plan('Migration plan');
        $objective = $this->objective($this->plan, 'ICT Office');
        $input = $this->input($objective, $this->office, 'Pending Review', 'progress_update');
        $before = $input->getAttributes();
        $migration = require database_path('migrations/2026_09_16_000001_add_submitted_input_review_and_scope.php');
        $migration->down();
        $this->assertFalse(Schema::hasTable('tblimplementation_input_scopes'));
        $this->assertFalse(Schema::hasColumn('tblimplementation_inputs', 'reviewed_at'));
        $migration->up();
        foreach ($before as $field => $value) {
            $this->assertSame($value, $input->fresh()->getAttributes()[$field]);
        }
        $this->assertDatabaseCount('tblimplementation_input_scopes', 0);
        $this->assertTrue($this->planner->fresh()->role->permissions->contains('code', 'implementation_inputs.review'));
        $this->assertTrue($this->office->fresh()->role->permissions->contains('code', 'implementation_inputs.view'));
        $this->assertFalse($this->office->fresh()->role->permissions->contains('code', 'implementation_inputs.review'));
    }

    private function snapshot(): array
    {
        return collect(Schema::getTableListing())->mapWithKeys(fn ($table) => [$table => DB::table($table)->get()->toJson()])->all();
    }

    private function user(string $role, ?string $office = null): User
    {
        return User::create(['first_name' => 'Input', 'last_name' => 'Reviewer', 'email' => fake()->unique()->safeEmail(),
            'password' => 'Password123!', 'status' => 'active', 'office' => $office,
            'role_id' => Role::where('role_name', $role)->sole()->role_id]);
    }

    private function plan(string $title): Strategic
    {
        return app(PlanCreationService::class)->create(['level' => 'strategic_plan', 'title' => $title,
            'mission' => 'Mission', 'vision' => 'Vision', 'core_values' => ['Integrity'], 'status' => 'draft'], $this->planner);
    }

    private function objective(Strategic $plan, string $office): StrategicObjective
    {
        $objective = StrategicObjective::create(['strategic_plan_id' => $plan->record_id, 'created_by' => $this->planner->user_id,
            'objective_title' => $office.' objective', 'objective_description' => 'Description', 'status' => 'draft']);
        app(ResponsibleUnitService::class)->assign([$objective->objective_id], ['responsible_office_agency' => $office], $this->planner);

        return $objective;
    }

    private function input(StrategicObjective $objective, User $submitter, string $status, string $type): ImplementationInput
    {
        return ImplementationInput::create([
            'strategic_plan_id' => $objective->strategic_plan_id, 'objective_id' => $objective->objective_id,
            'responsible_unit_id' => $objective->responsibleUnitAssignment->responsible_unit_id,
            'responsible_office_agency' => $submitter->office, 'submitted_by' => $submitter->user_id, 'submitter_name' => $submitter->name,
            'input_type' => $type, 'review_status' => $status, 'content' => '<script>Plain text feedback</script>',
            'submitted_at' => '2026-09-01 09:30:00',
        ]);
    }

    private function grant(User $user, Strategic $plan): void
    {
        DB::table('tblimplementation_input_scopes')->insert([
            'strategic_plan_id' => $plan->record_id, 'user_id' => $user->user_id, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function reviewUrl(): string
    {
        return '/api/implementation-inputs/'.$this->pending->input_id.'/review';
    }
}
