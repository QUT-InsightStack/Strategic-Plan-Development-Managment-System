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

class RoleMonitoringReportPermissionTest extends TestCase
{
    use RefreshDatabase;

    private const MIGRATION = 'migrations/2026_10_15_000002_grant_role_monitoring_report_permissions.php';

    public function test_migration_grants_report_permissions_to_planning_office_and_administrative_roles(): void
    {
        $roles = collect(['Planning Officer', 'Planner/Encoder', 'Office', 'Responsible Unit User', 'Administrative Admin'])
            ->map(fn ($name) => Role::firstOrCreate(['role_name' => $name], ['is_assignable' => true, 'is_protected' => false]));
        $untouched = Role::firstOrCreate(['role_name' => 'Unrelated Viewer'], ['is_assignable' => true, 'is_protected' => false]);

        (include database_path(self::MIGRATION))->up();
        (include database_path(self::MIGRATION))->up();

        foreach ($roles as $role) {
            $this->assertEqualsCanonicalizing(['reports.export', 'reports.view'],
                $role->permissions()->whereIn('code', ['reports.view', 'reports.export'])->pluck('code')->all(), $role->role_name);
        }
        $this->assertSame(0, $untouched->permissions()->whereIn('code', ['reports.view', 'reports.export'])->count());
    }

    public function test_office_report_contains_only_objectives_assigned_to_its_unit(): void
    {
        $planner = $this->user('Planning Officer', 'Planning Office', ['strategic_records.view', 'strategic_objectives.view', 'strategic_objectives.assign_responsible_unit']);
        $plan = app(PlanCreationService::class)->create(['level' => 'strategic_plan', 'title' => 'Monitoring plan',
            'mission' => 'Mission', 'vision' => 'Vision', 'core_values' => ['Integrity'], 'status' => 'draft'], $planner);
        $plan->forceFill(['planning_start_date' => '2025-01-01', 'planning_end_date' => '2030-12-31', 'status' => 'finished', 'approval_status' => 'approved'])->saveOrFail();
        $this->objective($plan, $planner, 'ICT Office', 'ICT objective');
        $this->objective($plan, $planner, 'Research Office', 'Research objective');

        $office = $this->user('Office', 'ICT Office', ['strategic_records.view', 'strategic_objectives.view']);
        (include database_path(self::MIGRATION))->up();
        $this->authenticateApiUser($office->fresh());

        $response = $this->getJson('/api/management/reports/master')->assertOk();
        $progress = collect($response->json('data.sections'))->firstWhere('id', 'progress');
        $this->assertSame(['ICT objective'], array_column($progress['tables'][0]['rows'], 'objective'));
        $this->assertStringContainsString('ICT Office', $response->json('data.meta.scope'));
        $this->get('/api/management/reports/master/export?format=csv&section=progress')->assertOk();
    }

    private function user(string $roleName, ?string $office, array $codes): User
    {
        $role = Role::firstOrCreate(['role_name' => $roleName], ['is_assignable' => true, 'is_protected' => false]);
        foreach ($codes as $code) {
            $permission = Permission::firstOrCreate(['code' => $code], ['permission_name' => $code, 'module' => explode('.', $code)[0]]);
            $role->permissions()->syncWithoutDetaching([$permission->permission_id]);
        }

        return User::create(['first_name' => 'Monitoring', 'last_name' => $roleName, 'email' => fake()->unique()->safeEmail(),
            'password' => 'Password123!', 'status' => 'active', 'role_id' => $role->role_id, 'office' => $office]);
    }

    private function objective(Strategic $plan, User $planner, string $office, string $title): void
    {
        $objective = StrategicObjective::create(['strategic_plan_id' => $plan->record_id, 'created_by' => $planner->user_id,
            'objective_title' => $title, 'objective_description' => 'Description', 'expected_outcome' => 'Outcome', 'target' => 'Target', 'status' => 'draft']);
        app(ResponsibleUnitService::class)->assign([$objective->objective_id], ['responsible_office_agency' => $office], $planner);
    }
}
