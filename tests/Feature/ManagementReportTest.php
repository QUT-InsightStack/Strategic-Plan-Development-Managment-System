<?php

namespace Tests\Feature;

use App\Http\Controllers\ManagementReportController;
use App\Models\Log;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use App\Services\PlanCreationService;
use App\Services\ResponsibleUnitService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ManagementReportTest extends TestCase
{
    use RefreshDatabase;

    private User $planner;

    private Strategic $plan;

    protected function setUp(): void
    {
        parent::setUp();
        $this->planner = $this->user('Planning Officer', 'Planning Office', ['strategic_records.view', 'strategic_objectives.view', 'strategic_objectives.assign_responsible_unit']);
        $this->plan = app(PlanCreationService::class)->create(['level' => 'strategic_plan', 'title' => 'Report plan',
            'mission' => 'Mission', 'vision' => 'Vision', 'core_values' => ['Integrity'], 'status' => 'draft'], $this->planner);
        $this->plan->forceFill(['planning_start_date' => '2020-01-01', 'planning_end_date' => '2021-12-31', 'status' => 'finished', 'approval_status' => 'approved'])->saveOrFail();
        $this->objective('ICT Office', 'Overdue objective', 40);
        $this->objective('Research Office', 'Completed objective', 100);
    }

    public function test_migration_grants_report_permissions_to_management_roles(): void
    {
        foreach (['reports.view', 'reports.export'] as $code) {
            $this->assertDatabaseHas('tblpermissions', ['code' => $code]);
        }
        $role = Role::firstOrCreate(['role_name' => 'Management'], ['is_assignable' => true, 'is_protected' => false]);
        (include database_path('migrations/2026_10_15_000001_grant_management_report_permissions.php'))->up();
        $this->assertEqualsCanonicalizing(['reports.export', 'reports.view'],
            $role->permissions()->whereIn('code', ['reports.view', 'reports.export'])->pluck('code')->all());
    }

    public function test_report_requires_authentication_and_reports_view(): void
    {
        $this->getJson('/api/management/reports/master')->assertUnauthorized();
        $this->authenticateApiUser($this->user('Report Reader Without Access', null, ['strategic_records.view', 'strategic_objectives.view']));
        $this->getJson('/api/management/reports/master')->assertForbidden();
    }

    public function test_report_returns_sections_in_order_with_dashboard_figures(): void
    {
        $this->authenticateApiUser($this->reportUser(['strategic_records.view', 'strategic_objectives.view']));
        $response = $this->getJson('/api/management/reports/master')->assertOk();
        $ids = collect($response->json('data.sections'))->pluck('id')->all();
        $this->assertSame(['cover', 'summary', 'plans', 'progress', 'alignment', 'offices', 'approvals', 'overdue', 'annex'], $ids);
        $kpis = collect($response->json('data.sections.1.kpis'))->keyBy('key');
        $this->assertSame(1, $kpis['plans']['value']);
        $this->assertSame('1 / 2', $kpis['objective_progress']['value']);
        $this->assertSame(1, $kpis['overdue']['value']);
        $this->assertNull($kpis['inputs']['value'], 'inputs KPI is not shown as zero without access');
        $overdue = collect($response->json('data.sections'))->firstWhere('id', 'overdue');
        $this->assertSame(['Overdue objective'], array_column($overdue['tables'][0]['rows'], 'objective'));
        $this->assertSame(['inputs'], array_column($response->json('data.omitted_sections'), 'id'));
    }

    public function test_sections_without_permission_are_omitted_and_listed_on_the_cover(): void
    {
        $this->authenticateApiUser($this->reportUser(['strategic_records.view']));
        $response = $this->getJson('/api/management/reports/master')->assertOk();
        $this->assertSame(['cover', 'summary', 'plans', 'approvals', 'annex'], collect($response->json('data.sections'))->pluck('id')->all());
        $this->assertSame(['progress', 'alignment', 'offices', 'inputs', 'overdue'], array_column($response->json('data.omitted_sections'), 'id'));
        $cover = collect($response->json('data.sections.0.fields'))->firstWhere('label', 'Sections omitted');
        $this->assertStringContainsString('3. Objective Progress', $cover['value']);
    }

    public function test_filters_follow_the_dashboard_rules(): void
    {
        $this->authenticateApiUser($this->reportUser(['strategic_records.view', 'strategic_objectives.view']));
        $this->getJson('/api/management/reports/master?period=2023-2028')->assertOk()->assertJsonPath('data.sections.1.kpis.0.value', 0);
        $response = $this->getJson('/api/management/reports/master?period=2020-2021&office=Research%20Office')->assertOk();
        $progress = collect($response->json('data.sections'))->firstWhere('id', 'progress');
        $this->assertSame(['Completed objective'], array_column($progress['tables'][0]['rows'], 'objective'));
        $this->getJson('/api/management/reports/master?status=objective:overdue')->assertOk()->assertJsonPath('data.sections.1.kpis.5.value', 1);
        $this->getJson('/api/management/reports/master?period=2020')->assertUnprocessable();
    }

    public function test_office_users_only_see_their_assigned_objectives(): void
    {
        $this->authenticateApiUser($this->reportUser(['strategic_records.view', 'strategic_objectives.view'], 'Responsible Unit User', 'ICT Office'));
        $response = $this->getJson('/api/management/reports/master')->assertOk();
        $alignment = collect($response->json('data.sections'))->firstWhere('id', 'alignment');
        $this->assertSame(['Overdue objective'], array_column($alignment['tables'][0]['rows'], 'objective'));
        $this->assertStringContainsString('ICT Office', $response->json('data.meta.scope'));
    }

    public function test_my_decisions_appear_only_for_workflow_participants(): void
    {
        $user = $this->reportUser(['strategic_records.view']);
        $this->authenticateApiUser($user);
        $approvals = fn () => collect($this->getJson('/api/management/reports/master')->json('data.sections'))->firstWhere('id', 'approvals');
        $this->assertSame(['approvals'], array_column($approvals()['tables'], 'id'));

        $workflowId = DB::table('approval_workflows')->insertGetId(['name' => 'Report workflow', 'status' => 'active', 'version' => 1, 'created_at' => now(), 'updated_at' => now()]);
        $submissionId = DB::table('plan_submissions')->insertGetId(['plan_id' => $this->plan->record_id, 'workflow_id' => $workflowId, 'workflow_version' => 1,
            'workflow_snapshot' => '{}', 'plan_snapshot' => '{}', 'submitted_by' => $this->planner->user_id, 'status' => 'approved', 'current_sequence' => null, 'submitted_at' => now()]);
        $stageId = DB::table('plan_submission_stages')->insertGetId(['submission_id' => $submissionId, 'sequence' => 1, 'name' => 'Executive review',
            'approver_type' => 'user', 'approver_id' => $user->user_id, 'approver_label' => 'Reviewer', 'status' => 'approved']);
        DB::table('plan_workflow_history')->insert(['submission_id' => $submissionId, 'stage_id' => $stageId, 'actor_id' => $user->user_id,
            'actor_name' => 'Reviewer', 'action' => 'approved', 'comment' => '=SUM(A1)', 'created_at' => now()]);

        $decisions = collect($approvals()['tables'])->firstWhere('id', 'my_decisions');
        $this->assertSame([['plan' => 'Report plan', 'stage' => 'Executive review', 'decision' => 'Approved']],
            array_map(fn ($row) => array_intersect_key($row, array_flip(['plan', 'stage', 'decision'])), $decisions['rows']));
    }

    public function test_export_requires_reports_export_and_writes_an_audit_entry(): void
    {
        $this->authenticateApiUser($this->reportUser(['strategic_records.view', 'strategic_objectives.view']));
        $this->get('/api/management/reports/master/export?format=csv&section=overdue')->assertForbidden();

        $user = $this->reportUser(['strategic_records.view', 'strategic_objectives.view', 'reports.export'], 'Report Exporter');
        $this->authenticateApiUser($user);
        $response = $this->get('/api/management/reports/master/export?format=csv&section=overdue&period=2020-2021')->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
        $csv = $response->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF\"Strategic plan\",\"Objective\"", $csv);
        $this->assertStringContainsString('"Overdue objective"', $csv);
        $log = Log::where('operation', 'management_report.exported')->latest('log_id')->first();
        $this->assertNotNull($log);
        $this->assertSame($user->user_id, (int) $log->user_id);
        $this->assertSame('overdue', $log->metadata['section']);
        $this->assertSame('csv', $log->metadata['format']);
        $this->assertSame(['period' => '2020-2021'], $log->metadata['filters']);

        $this->get('/api/management/reports/master/export?format=csv&section=inputs')->assertForbidden();
        $this->get('/api/management/reports/master/export?format=csv&section=annex')->assertNotFound();
        $this->getJson('/api/management/reports/master/export?format=xlsx&section=plans')->assertUnprocessable();
    }

    public function test_csv_cells_neutralise_spreadsheet_formulas(): void
    {
        $this->assertSame("\"'=SUM(A1)\",\"plain\",\"say \"\"hi\"\"\",\"' -1\"\r\n", ManagementReportController::csvLine(['=SUM(A1)', 'plain', 'say "hi"', ' -1']));
    }

    private function reportUser(array $codes, string $roleName = 'Report Viewer', ?string $office = null): User
    {
        return $this->user($roleName, $office, [...$codes, 'reports.view']);
    }

    private function user(string $roleName, ?string $office, array $codes): User
    {
        $role = Role::firstOrCreate(['role_name' => $roleName], ['is_assignable' => true, 'is_protected' => false]);
        foreach ($codes as $code) {
            $permission = Permission::firstOrCreate(['code' => $code], ['permission_name' => $code, 'module' => explode('.', $code)[0]]);
            $role->permissions()->syncWithoutDetaching([$permission->permission_id]);
        }

        return User::create(['first_name' => 'Report', 'last_name' => $roleName, 'email' => fake()->unique()->safeEmail(),
            'password' => 'Password123!', 'status' => 'active', 'role_id' => $role->role_id, 'office' => $office]);
    }

    private function objective(string $office, string $title, int $progress): StrategicObjective
    {
        $objective = StrategicObjective::create(['strategic_plan_id' => $this->plan->record_id, 'created_by' => $this->planner->user_id,
            'objective_title' => $title, 'objective_description' => 'Description', 'expected_outcome' => 'Outcome', 'target' => 'Target', 'status' => 'draft']);
        app(ResponsibleUnitService::class)->assign([$objective->objective_id], ['responsible_office_agency' => $office], $this->planner);
        DB::table('tblstrategic_objectives')->where('objective_id', $objective->objective_id)->update(['progress_percentage' => $progress]);

        return $objective->refresh();
    }
}
