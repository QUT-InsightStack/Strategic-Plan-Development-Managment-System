<?php

namespace Tests\Feature;

use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use App\Models\Role;
use App\Services\PlanCreationService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DraftPlanArchiveTest extends TestCase
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

        $this->planner = $this->account('Planning Officer');
    }

    public function test_owner_can_archive_and_restore_draft_without_finalizing_it(): void
    {
        $plan = $this->plan();
        $objective = StrategicObjective::create([
            'strategic_plan_id' => $plan->record_id,
            'objective_title' => 'Keep this objective',
            'created_by' => $this->planner->user_id,
            'status' => 'draft',
        ]);
        $objectiveBefore = $objective->fresh()->getAttributes();
        $approvalBefore = $plan->fresh()->approval_status;

        $this->authenticateApiUser($this->planner);

        $this->patchJson($this->url($plan), ['status' => 'archived'])
            ->assertOk()
            ->assertJsonPath('data.status', 'archived');

        $this->assertDatabaseHas('tblstrategic_record', [
            'record_id' => $plan->record_id,
            'status' => 'archived',
            'status_before_archive' => 'draft',
            'archived_by' => $this->planner->user_id,
        ]);

        $this->assertSame(
            $objectiveBefore,
            $objective->fresh()->getAttributes()
        );

        $this->patchJson($this->url($plan), ['status' => 'finished'])
            ->assertOk()
            ->assertJsonPath('data.status', 'draft');

        $plan->refresh();

        $this->assertNull($plan->status_before_archive);
        $this->assertNull($plan->archived_at);
        $this->assertNull($plan->archived_by);
        $this->assertSame($approvalBefore, $plan->approval_status);
        $this->assertSame(
            $objectiveBefore,
            $objective->fresh()->getAttributes()
        );
    }

    public function test_another_planner_cannot_archive_or_restore_the_plan(): void
    {
        $plan = $this->plan();
        $other = $this->account('Planning Officer');

        $this->authenticateApiUser($other);
        $this->patchJson($this->url($plan), ['status' => 'archived'])
            ->assertForbidden();

        $this->authenticateApiUser($this->planner);
        $this->patchJson($this->url($plan), ['status' => 'archived'])
            ->assertOk();

        $this->authenticateApiUser($other);
        $this->patchJson($this->url($plan), ['status' => 'finished'])
            ->assertForbidden();

        $this->assertSame('archived', $plan->fresh()->status);
    }

    public function test_administrative_admin_can_archive_and_restore_another_planners_draft(): void
    {
        $plan = $this->plan();
        $admin = $this->account('Administrative Admin');

        $this->authenticateApiUser($admin);

        $this->patchJson($this->url($plan), ['status' => 'archived'])
            ->assertOk();

        $this->patchJson($this->url($plan), ['status' => 'finished'])
            ->assertOk()
            ->assertJsonPath('data.status', 'draft');

        $this->assertSame(
            $this->planner->user_id,
            (int) $plan->fresh()->created_by
        );
    }

    public function test_office_without_archive_permission_cannot_archive(): void
    {
        $plan = $this->plan();

        $this->authenticateApiUser($this->account('Office'));

        $this->patchJson($this->url($plan), ['status' => 'archived'])
            ->assertForbidden();

        $this->assertSame('draft', $plan->fresh()->status);
    }

    public function test_approved_finalized_plan_restores_to_finished_and_keeps_approval(): void
    {
        $plan = $this->plan('finished');
        $plan->forceFill(['approval_status' => 'approved'])->save();

        $this->authenticateApiUser($this->planner);

        $this->patchJson($this->url($plan), ['status' => 'archived'])
            ->assertOk();

        $this->assertSame(
            'finished',
            $plan->fresh()->status_before_archive
        );

        $this->patchJson($this->url($plan), ['status' => 'finished'])
            ->assertOk()
            ->assertJsonPath('data.status', 'finished');

        $this->assertSame('approved', $plan->fresh()->approval_status);
    }

    public function test_plan_under_approval_cannot_be_archived(): void
    {
        $plan = $this->plan('finished');
        $plan->forceFill(['approval_status' => 'under_approval'])->save();

        $this->authenticateApiUser($this->planner);

        $this->patchJson($this->url($plan), ['status' => 'archived'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->assertSame('finished', $plan->fresh()->status);
        $this->assertNull($plan->fresh()->archived_at);
    }

    public function test_database_rejects_restoring_archived_draft_as_finished(): void
    {
        $plan = $this->plan();

        $this->authenticateApiUser($this->planner);
        $this->patchJson($this->url($plan), ['status' => 'archived'])
            ->assertOk();

        try {
            DB::table('tblstrategic_record')
                ->where('record_id', $plan->record_id)
                ->update([
                    'status' => 'finished',
                    'status_before_archive' => null,
                    'archived_at' => null,
                    'archived_by' => null,
                ]);

            $this->fail('The database allowed a draft to restore as finished.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString(
                'Restore the plan to its status before archival.',
                $exception->getMessage()
            );
        }

        $this->assertSame('archived', $plan->fresh()->status);
        $this->assertSame('draft', $plan->fresh()->status_before_archive);
    }
    public function test_archived_filter_preserves_plan_visibility_scope(): void
{
    $plan = $this->plan();

    $this->authenticateApiUser($this->planner);
    $this->patchJson($this->url($plan), ['status' => 'archived'])
        ->assertOk();

    // Archived plans stay out of the default listing.
    $this->getJson('/api/strategic-plans')
        ->assertOk()
        ->assertJsonPath('meta.total', 0);

    // The owner can find the archived plan to restore it.
    $this->getJson('/api/strategic-plans?status=archived')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.record_id', $plan->record_id)
        ->assertJsonPath('data.0.status', 'archived');

    // Another planner cannot see it.
    $this->authenticateApiUser($this->account('Planning Officer'));
    $this->getJson('/api/strategic-plans?status=archived')
        ->assertOk()
        ->assertJsonPath('meta.total', 0);

    // Administrative Admin can find it.
    $this->authenticateApiUser($this->account('Administrative Admin'));
    $this->getJson('/api/strategic-plans?status=archived')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.record_id', $plan->record_id);
}
    private function account(string $role): User
    {
        return User::create([
            'first_name' => 'Archive',
            'last_name' => 'Tester',
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('ArchiveTestPassword123!'),
            'status' => 'active',
            'role_id' => Role::where('role_name', $role)
                ->firstOrFail()->role_id,
        ])->refresh();
    }

    private function plan(string $status = 'draft'): Strategic
    {
        return app(PlanCreationService::class)->create([
            'level' => 'strategic_plan',
            'title' => 'Archive lifecycle test',
            'mission' => 'Improve services',
            'vision' => 'Accessible services',
            'core_values' => ['Integrity'],
            'status' => $status,
        ], $this->planner);
    }

    private function url(Strategic $plan): string
    {
        return '/api/strategic-plans/'.$plan->record_id.'/status';
    }
}