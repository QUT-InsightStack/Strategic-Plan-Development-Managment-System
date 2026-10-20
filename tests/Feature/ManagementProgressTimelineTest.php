<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use App\Services\PlanCreationService;
use App\Services\ResponsibleUnitService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ManagementProgressTimelineTest extends TestCase
{
    use RefreshDatabase;

    private User $planner;

    private Strategic $plan;

    protected function setUp(): void
    {
        parent::setUp();
        $this->planner = $this->user('Planning Officer', 'Planning Office', ['strategic_objectives.view', 'strategic_objectives.correct_progress', 'strategic_objectives.view_progress', 'strategic_objectives.assign_responsible_unit']);
        $this->plan = app(PlanCreationService::class)->create(['level' => 'strategic_plan', 'title' => 'Timeline plan',
            'mission' => 'Mission', 'vision' => 'Vision', 'core_values' => ['Integrity'], 'status' => 'draft'], $this->planner);
        $this->plan->forceFill(['planning_start_date' => '2023-01-01', 'planning_end_date' => '2028-12-31'])->saveOrFail();
    }

    public function test_requires_authentication_and_objective_view_permission(): void
    {
        $this->getJson($this->url())->assertUnauthorized();
        $this->authenticateApiUser($this->user('Timeline Without Objective Access', null, []));
        $this->getJson($this->url())->assertForbidden();
    }

    public function test_management_receives_objectives_and_progress_history_for_the_plan(): void
    {
        $objective = $this->objective('ICT Office');
        $this->plan->forceFill(['status' => 'finished', 'approval_status' => 'approved'])->save();
        $this->authenticateApiUser($this->planner);
        $this->patchJson('/api/strategic-objectives/'.$objective->objective_id.'/progress', ['progress_percentage' => 40, 'reason' => 'First report'])->assertOk();
        $this->patchJson('/api/strategic-objectives/'.$objective->objective_id.'/progress', ['progress_percentage' => 100, 'reason' => 'Completed'])->assertOk();

        $this->authenticateApiUser($this->user('Management', null, ['strategic_objectives.view']));
        $response = $this->getJson($this->url())->assertOk()
            ->assertJsonPath('data.plan_id', $this->plan->record_id)
            ->assertJsonPath('data.planning_start_date', '2023-01-01')
            ->assertJsonCount(1, 'data.objectives')
            ->assertJsonCount(2, 'data.updates')
            ->assertJsonPath('data.updates.0.new_status', 'in_progress')
            ->assertJsonPath('data.updates.1.new_status', 'completed');
        $this->assertArrayNotHasKey('reason', $response->json('data.updates.0'));
        $this->assertArrayNotHasKey('updater_name', $response->json('data.updates.0'));
    }

    public function test_office_users_only_receive_their_assigned_objectives(): void
    {
        $own = $this->objective('ICT Office');
        $this->objective('Research Office');
        $this->authenticateApiUser($this->user('Responsible Unit User', 'ICT Office', ['strategic_objectives.view']));
        $this->getJson($this->url())->assertOk()
            ->assertJsonCount(1, 'data.objectives')
            ->assertJsonPath('data.objectives.0.objective_id', $own->objective_id);
    }

    public function test_plans_outside_the_users_scope_are_forbidden_and_unknown_plans_are_not_found(): void
    {
        $this->authenticateApiUser($this->user('Planning Officer', 'Planning Office', ['strategic_objectives.view']));
        $this->getJson($this->url())->assertForbidden();
        $this->getJson('/api/management/progress-timeline?plan_id=999999')->assertNotFound();
        $this->getJson('/api/management/progress-timeline')->assertUnprocessable();
    }

    private function url(): string
    {
        return '/api/management/progress-timeline?plan_id='.$this->plan->record_id;
    }

    private function user(string $roleName, ?string $office, array $codes): User
    {
        $role = Role::firstOrCreate(['role_name' => $roleName], ['is_assignable' => true, 'is_protected' => false]);
        foreach ($codes as $code) {
            $permission = Permission::firstOrCreate(['code' => $code], ['permission_name' => $code, 'module' => 'strategic_objectives']);
            $role->permissions()->syncWithoutDetaching([$permission->permission_id]);
        }

        return User::create(['first_name' => 'Timeline', 'last_name' => $roleName, 'email' => fake()->unique()->safeEmail(),
            'password' => 'Password123!', 'status' => 'active', 'role_id' => $role->role_id, 'office' => $office]);
    }

    private function objective(string $office): StrategicObjective
    {
        $objective = StrategicObjective::create(['strategic_plan_id' => $this->plan->record_id, 'created_by' => $this->planner->user_id,
            'objective_title' => 'Objective '.$office, 'objective_description' => 'Description',
            'expected_outcome' => 'Outcome', 'target' => 'Target', 'status' => 'draft']);
        app(ResponsibleUnitService::class)->assign([$objective->objective_id], ['responsible_office_agency' => $office], $this->planner);

        return $objective->refresh();
    }
}
