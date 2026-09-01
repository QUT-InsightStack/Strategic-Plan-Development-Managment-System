<?php

namespace Tests\Feature;

use App\Http\Middleware\ValidateAuthVersion;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use App\Services\PlanCreationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class StrategicObjectiveApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authorized_user_can_create_an_objective_and_backend_sets_created_by(): void
    {
        $actor = $this->createUserWithPermissions(['strategic_objectives.create']);
        $plan = $this->createPlan($actor, ['status' => 'finished']);

        $this->actingAs($actor, 'api');

        $response = $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/strategic-objectives', [
                'strategic_plan_id' => $plan->record_id,
                'objective_title' => 'Improve digital service delivery',
                'objective_description' => 'Modernize public-facing systems.',
                'expected_outcome' => 'Faster service turnaround times.',
                'indicator' => 'Average response time',
                'target' => 'Under 24 hours',
                'responsible_office_agency' => 'ICT Office',
                'status' => 'published',
            ]);

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.created_by', $actor->user_id)
            ->assertJsonPath('data.strategic_plan_id', $plan->record_id)
            ->assertJsonPath('data.strategic_plan.record_id', $plan->record_id);

        $this->assertDatabaseHas('tblstrategic_objectives', [
            'objective_title' => 'Improve digital service delivery',
            'strategic_plan_id' => $plan->record_id,
            'created_by' => $actor->user_id,
            'status' => 'published',
        ]);
    }

    public function test_create_rejects_incomplete_published_objective_data(): void
    {
        $actor = $this->createUserWithPermissions(['strategic_objectives.create']);
        $plan = $this->createPlan($actor, ['status' => 'finished']);

        $this->actingAs($actor, 'api');

        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->postJson('/api/strategic-objectives', [
                'strategic_plan_id' => $plan->record_id,
                'status' => 'published',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'objective_title',
                'objective_description',
                'expected_outcome',
                'target',
                'responsible_office_agency',
            ]);

        $this->assertDatabaseCount('tblstrategic_objectives', 0);
    }

    public function test_index_returns_paginated_objectives_with_parent_plan_information_and_excludes_deleted_records(): void
    {
        $actor = $this->createUserWithPermissions(['strategic_objectives.view']);
        $plan = $this->createPlan($actor, ['status' => 'finished']);

        $keptObjective = $this->createObjective($plan, $actor, [
            'objective_title' => 'Visible objective',
            'status' => 'draft',
        ]);
        $deletedObjective = $this->createObjective($plan, $actor, [
            'objective_title' => 'Deleted objective',
        ]);
        $deletedObjective->update([
            'status' => 'deleted',
            'deleted_at' => now(),
        ]);

        $this->actingAs($actor, 'api');

        $response = $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson('/api/strategic-objectives?per_page=1');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.objective_id', $keptObjective->objective_id)
            ->assertJsonPath('data.0.strategic_plan.record_id', $plan->record_id)
            ->assertJsonPath('data.0.strategic_plan.title', $plan->title);
    }

    public function test_index_applies_supported_filters_including_archived_status(): void
    {
        $actor = $this->createUserWithPermissions([
            'strategic_objectives.view',
            'strategic_records.archive',
        ]);
        $activePlan = $this->createPlan($actor, ['status' => 'finished']);
        $archivablePlan = $this->createPlan($actor, [
            'status' => 'finished',
            'title' => '2025 Transformation Plan',
        ]);

        $this->createObjective($activePlan, $actor, [
            'objective_title' => 'Keep service desks stable',
            'responsible_office_agency' => 'Operations',
            'status' => 'draft',
        ]);

        $archivedObjective = $this->createObjective($archivablePlan, $actor, [
            'objective_title' => 'Archive me',
            'objective_description' => 'Legacy rollout objective',
            'expected_outcome' => 'Historical reference only',
            'indicator' => 'Completion rate',
            'target' => '100%',
            'responsible_office_agency' => 'Finance Office',
            'status' => 'published',
        ]);

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->patchJson("/api/strategic-plans/{$archivablePlan->record_id}/status", [
                'status' => 'archived',
            ])
            ->assertOk();

        StrategicObjective::whereKey($archivedObjective->objective_id)->update([
            'updated_at' => now()->subYear(),
        ]);

        $response = $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson(
                '/api/strategic-objectives?'
                . http_build_query([
                    'search' => 'Archive',
                    'plan_id' => $archivablePlan->record_id,
                    'status' => 'archived',
                    'responsible_office_agency' => 'Finance',
                    'year' => now()->subYear()->year,
                    'per_page' => 10,
                ])
            );

        $response->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.objective_id', $archivedObjective->objective_id)
            ->assertJsonPath('data.0.status', 'archived')
            ->assertJsonPath('data.0.strategic_plan.record_id', $archivablePlan->record_id)
            ->assertJsonPath('data.0.strategic_plan.title', '2025 Transformation Plan');
    }

    public function test_show_returns_objective_with_parent_plan_information(): void
    {
        $actor = $this->createUserWithPermissions(['strategic_objectives.view']);
        $plan = $this->createPlan($actor, ['status' => 'finished']);
        $objective = $this->createObjective($plan, $actor, [
            'objective_title' => 'Visible objective details',
        ]);

        $this->actingAs($actor, 'api');

        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->getJson("/api/strategic-objectives/{$objective->objective_id}")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.objective_id', $objective->objective_id)
            ->assertJsonPath('data.strategic_plan.record_id', $plan->record_id)
            ->assertJsonPath('data.strategic_plan.title', $plan->title);
    }

    public function test_authorized_user_can_update_an_objective_without_changing_creation_or_relationship_metadata(): void
    {
        $creator = $this->createUser();
        $actor = $this->createUserWithPermissions(['strategic_objectives.update']);
        $plan = $this->createPlan($creator, ['status' => 'finished']);
        $objective = $this->createObjective($plan, $creator, [
            'objective_title' => 'Original objective',
            'responsible_office_agency' => 'Planning Office',
        ]);

        $this->actingAs($actor, 'api');

        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/strategic-objectives/{$objective->objective_id}", [
                'objective_title' => 'Updated objective',
                'responsible_office_agency' => 'Corporate Planning Office',
                'indicator' => 'Annual milestone completion',
            ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.objective_title', 'Updated objective')
            ->assertJsonPath('data.updated_by', $actor->user_id)
            ->assertJsonPath('data.created_by', $creator->user_id)
            ->assertJsonPath('data.strategic_plan_id', $plan->record_id);

        $objective->refresh();
        $this->assertSame('Updated objective', $objective->objective_title);
        $this->assertSame('Corporate Planning Office', $objective->responsible_office_agency);
        $this->assertSame($actor->user_id, $objective->updated_by);
        $this->assertSame($creator->user_id, $objective->created_by);
        $this->assertSame($plan->record_id, $objective->strategic_plan_id);
    }

    public function test_update_rejects_reassignment_and_frontend_supplied_updated_by(): void
    {
        $actor = $this->createUserWithPermissions(['strategic_objectives.update']);
        $plan = $this->createPlan($actor, ['status' => 'finished']);
        $otherPlan = $this->createPlan($actor, ['status' => 'finished']);
        $objective = $this->createObjective($plan, $actor);

        $this->actingAs($actor, 'api');

        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/strategic-objectives/{$objective->objective_id}", [
                'strategic_plan_id' => $otherPlan->record_id,
                'updated_by' => 999999,
                'objective_title' => 'Attempted reassignment',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['strategic_plan_id', 'updated_by']);

        $objective->refresh();
        $this->assertSame($plan->record_id, $objective->strategic_plan_id);
        $this->assertSame($actor->user_id, $objective->created_by);
    }

    public function test_user_without_update_permission_cannot_update_objectives(): void
    {
        $viewer = $this->createUserWithPermissions(['strategic_objectives.view']);
        $plan = $this->createPlan($viewer, ['status' => 'finished']);
        $objective = $this->createObjective($plan, $viewer);

        $this->actingAs($viewer, 'api');

        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/strategic-objectives/{$objective->objective_id}", [
                'objective_title' => 'Forbidden change',
            ])
            ->assertForbidden();
    }

    public function test_archived_objective_updates_are_rejected(): void
    {
        $actor = $this->createUserWithPermissions([
            'strategic_objectives.update',
            'strategic_records.archive',
        ]);
        $plan = $this->createPlan($actor, ['status' => 'finished']);
        $objective = $this->createObjective($plan, $actor, [
            'objective_title' => 'Archived later',
            'status' => 'published',
        ]);

        $this->actingAs($actor, 'api');
        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->patchJson("/api/strategic-plans/{$plan->record_id}/status", [
                'status' => 'archived',
            ])
            ->assertOk();

        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->putJson("/api/strategic-objectives/{$objective->objective_id}", [
                'objective_title' => 'Should not update',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);

        $objective->refresh();
        $this->assertSame('Archived later', $objective->objective_title);
        $this->assertSame('archived', $objective->status);
    }

    public function test_archiving_a_finished_plan_cascades_to_its_objectives_without_changing_relationships(): void
    {
        $actor = $this->createUserWithPermissions(['strategic_records.archive']);
        $plan = $this->createPlan($actor, ['status' => 'finished']);
        $draftObjective = $this->createObjective($plan, $actor, [
            'status' => 'draft',
        ]);
        $publishedObjective = $this->createObjective($plan, $actor, [
            'status' => 'published',
        ]);

        $this->actingAs($actor, 'api');

        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->patchJson("/api/strategic-plans/{$plan->record_id}/status", [
                'status' => 'archived',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'archived');

        $draftObjective->refresh();
        $publishedObjective->refresh();

        $this->assertSame('archived', $draftObjective->status);
        $this->assertSame('draft', $draftObjective->status_before_archive);
        $this->assertNotNull($draftObjective->archived_at);
        $this->assertSame($actor->user_id, $draftObjective->archived_by);
        $this->assertSame($plan->record_id, $draftObjective->strategic_plan_id);

        $this->assertSame('archived', $publishedObjective->status);
        $this->assertSame('published', $publishedObjective->status_before_archive);
        $this->assertNotNull($publishedObjective->archived_at);
        $this->assertSame($actor->user_id, $publishedObjective->archived_by);
        $this->assertSame($plan->record_id, $publishedObjective->strategic_plan_id);
    }

    public function test_archiving_is_rejected_when_the_parent_plan_is_not_finished(): void
    {
        $actor = $this->createUserWithPermissions(['strategic_records.archive']);
        $plan = $this->createPlan($actor, ['status' => 'draft']);
        $objective = $this->createObjective($plan, $actor, ['status' => 'draft']);

        $this->actingAs($actor, 'api');

        $this->withoutMiddleware(ValidateAuthVersion::class)
            ->patchJson("/api/strategic-plans/{$plan->record_id}/status", [
                'status' => 'archived',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['status']);

        $objective->refresh();
        $this->assertSame('draft', $objective->status);
        $this->assertNull($objective->archived_at);
        $this->assertNull($objective->status_before_archive);
    }

    private function createPlan(User $creator, array $overrides = []): Strategic
    {
        return app(PlanCreationService::class)->create(array_merge([
            'level' => 'strategic_plan',
            'title' => 'Strategic Plan ' . fake()->unique()->words(2, true),
            'description' => 'Plan description',
            'mission' => 'Mission ' . fake()->unique()->sentence(),
            'vision' => 'Vision ' . fake()->unique()->sentence(),
            'core_values' => ['Integrity'],
            'status' => 'finished',
        ], $overrides), $creator);
    }

    private function createObjective(Strategic $plan, User $creator, array $overrides = []): StrategicObjective
    {
        return StrategicObjective::create(array_merge([
            'strategic_plan_id' => $plan->record_id,
            'created_by' => $creator->user_id,
            'updated_by' => null,
            'objective_title' => 'Objective ' . fake()->unique()->words(2, true),
            'objective_description' => 'Objective description',
            'expected_outcome' => 'Expected outcome',
            'indicator' => 'Indicator',
            'target' => 'Target',
            'responsible_office_agency' => 'Planning Office',
            'status' => 'draft',
            'status_before_archive' => null,
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => null,
        ], $overrides));
    }

    /**
     * @param  list<string>  $codes
     */
    private function createUserWithPermissions(array $codes): User
    {
        $role = Role::create([
            'role_name' => 'Role ' . fake()->unique()->word(),
            'is_assignable' => true,
            'is_protected' => false,
        ]);

        foreach ($codes as $code) {
            $permission = Permission::firstOrCreate(
                ['code' => $code],
                [
                    'permission_name' => $code,
                    'description' => $code,
                    'module' => explode('.', $code)[0],
                ]
            );

            $role->permissions()->attach($permission->permission_id);
        }

        return $this->createUser(['role_id' => $role->role_id]);
    }

    private function createUser(array $overrides = []): User
    {
        return User::create(array_merge([
            'first_name' => 'Test',
            'last_name' => 'User',
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('password'),
            'status' => 'active',
            'role_id' => null,
        ], $overrides));
    }
}
