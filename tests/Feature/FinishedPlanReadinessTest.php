<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use App\Services\PlanCreationService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class FinishedPlanReadinessTest extends TestCase
{
    use RefreshDatabase;

    private User $planner;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([
            RolesSeeder::class,
            PermissionSeeder::class,
            RolePermissionSeeder::class,
        ]);

        $this->planner = User::create([
            'first_name' => 'Readiness',
            'last_name' => 'Tester',
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('ReadinessTestPassword123!'),
            'status' => 'active',
            'role_id' => Role::where('role_name', 'Planning Officer')->firstOrFail()->role_id,
        ])->refresh();
    }

    public function test_new_plan_cannot_be_created_as_finished(): void
    {
        $this->authenticateApiUser($this->planner);

        $this->postJson('/api/strategic-plans', $this->payload('finished'))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['objectives']);

        $this->assertSame(0, Strategic::count());
    }

    public function test_incomplete_draft_cannot_be_saved_as_finished(): void
    {
        $plan = $this->draftPlan();
        $this->authenticateApiUser($this->planner);

        $this->putJson('/api/strategic-plans/'.$plan->record_id, ['title' => 'Changed title'] + $this->payload('finished'))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['objectives']);

        $this->assertDatabaseHas('tblstrategic_record', [
            'record_id' => $plan->record_id,
            'status' => 'draft',
            'title' => 'Readiness plan',
        ]);
    }

    public function test_complete_draft_can_be_saved_as_finished(): void
    {
        $plan = $this->draftPlan();
        StrategicObjective::create([
            'strategic_plan_id' => $plan->record_id,
            'objective_title' => 'Improve access',
            'expected_outcome' => 'More people served',
            'indicator' => 'People served',
            'target' => '1000',
            'responsible_office_agency' => 'Planning Office',
            'created_by' => $this->planner->user_id,
            'status' => 'draft',
        ]);
        $this->authenticateApiUser($this->planner);

        $this->putJson('/api/strategic-plans/'.$plan->record_id, $this->payload('finished'))
            ->assertOk()
            ->assertJsonPath('data.status', 'finished');
    }

    private function draftPlan(): Strategic
    {
        return app(PlanCreationService::class)->create($this->payload('draft'), $this->planner);
    }

    private function payload(string $status): array
    {
        return [
            'level' => 'strategic_plan',
            'title' => 'Readiness plan',
            'mission' => 'Improve services',
            'vision' => 'Accessible services',
            'core_values' => ['Integrity'],
            'planning_start_date' => '2026-01-01',
            'planning_end_date' => '2028-12-31',
            'status' => $status,
        ];
    }
}
