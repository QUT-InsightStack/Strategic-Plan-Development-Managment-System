<?php

namespace Tests\Feature;

use App\Models\Log;
use App\Models\ManagementObjectiveComment;
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

class ManagementObjectiveCommentTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;
    private User $planner;
    private Strategic $plan;
    private StrategicObjective $objective;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed([
            PermissionSeeder::class,
            RolesSeeder::class,
            RolePermissionSeeder::class,
        ]);

        $this->manager = $this->user('Management');
        $this->planner = $this->user('Planning Officer');

        $this->plan = app(PlanCreationService::class)->create([
            'level' => 'strategic_plan',
            'title' => 'Comment workflow plan',
            'mission' => 'Improve services',
            'vision' => 'Accessible services',
            'core_values' => ['Integrity'],
            'status' => 'draft',
        ], $this->planner);

        $this->objective = StrategicObjective::create([
            'strategic_plan_id' => $this->plan->record_id,
            'created_by' => $this->planner->user_id,
            'objective_title' => 'Improve service delivery',
            'status' => 'draft',
        ]);
    }

    private function user(string $role): User
    {
        return User::create([
            'first_name' => 'Comment',
            'last_name' => 'Tester',
            'email' => fake()->unique()->safeEmail(),
            'password' => Hash::make('CommentPassword123!'),
            'status' => 'active',
            'role_id' => Role::where('role_name', $role)
                ->firstOrFail()->role_id,
        ])->refresh();
    }

    private function createComment(): int
    {
        $this->authenticateApiUser($this->manager);

        return $this->postJson(
            "/api/strategic-objectives/{$this->objective->objective_id}/management-comments",
            ['content' => 'Please review the objective target.']
        )->assertCreated()
            ->assertJsonPath('data.acknowledgement_status', 'not_acknowledged')
            ->assertJsonPath('data.completion_status', 'open')
            ->assertJsonPath('data.author_id', $this->manager->user_id)
            ->json('data.comment_id');
    }

    private function url(int $id, string $action = ''): string
    {
        return "/api/management-objective-comments/{$id}"
            .($action !== '' ? "/{$action}" : '');
    }

    public function test_authentication_and_role_permissions_are_required(): void
    {
        $this->getJson('/api/management-objective-comments')
            ->assertUnauthorized();

        $office = $this->user('Office');
        $this->authenticateApiUser($office);

        $this->getJson('/api/management-objective-comments')
            ->assertForbidden();

        $this->postJson(
            "/api/strategic-objectives/{$this->objective->objective_id}/management-comments",
            ['content' => 'Not permitted.']
        )->assertForbidden();

        $this->assertDatabaseCount('tblmanagement_objective_comments', 0);
    }

    public function test_creation_rejects_blank_content_and_ignores_forged_workflow_fields(): void
    {
        $this->authenticateApiUser($this->manager);
        $url = "/api/strategic-objectives/{$this->objective->objective_id}/management-comments";

        $this->postJson($url, ['content' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('content');

        $this->postJson($url, [
            'content' => 'Review this objective.',
            'author_id' => $this->planner->user_id,
            'acknowledgement_status' => 'acknowledged',
            'completion_status' => 'completed',
            'closed_by' => $this->manager->user_id,
        ])->assertCreated()
            ->assertJsonPath('data.author_id', $this->manager->user_id)
            ->assertJsonPath('data.acknowledgement_status', 'not_acknowledged')
            ->assertJsonPath('data.completion_status', 'open')
            ->assertJsonPath('data.closed_by', null);
    }

    public function test_full_workflow_preserves_objective_and_plan_and_records_audits(): void
    {
        $planBefore = $this->plan->fresh()->getAttributes();
        $objectiveBefore = $this->objective->fresh()->getAttributes();
        $id = $this->createComment();

        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url($id, 'acknowledge'))
            ->assertOk()
            ->assertJsonPath('data.acknowledgement_status', 'acknowledged')
            ->assertJsonPath('data.completion_status', 'open')
            ->assertJsonPath('data.acknowledged_by', $this->planner->user_id);

        $this->authenticateApiUser($this->manager);
        $this->postJson($this->url($id, 'close'), [
            'completion_status' => 'completed',
            'closing_remarks' => 'The revised target addresses the feedback.',
        ])->assertOk()
            ->assertJsonPath('data.completion_status', 'completed')
            ->assertJsonPath('data.closed_by', $this->manager->user_id);

        $this->assertSame($planBefore, $this->plan->fresh()->getAttributes());
        $this->assertSame(
            $objectiveBefore,
            $this->objective->fresh()->getAttributes()
        );

        foreach (['created', 'acknowledged', 'closed'] as $event) {
            $this->assertSame(
                1,
                Log::where('operation', 'management_objective_comment.'.$event)
                    ->where('resource_id', $id)
                    ->where('outcome', 'success')
                    ->count()
            );
        }
    }

    public function test_closure_requires_acknowledgement_author_and_remarks(): void
    {
        $id = $this->createComment();

        $this->postJson($this->url($id, 'close'), [
            'completion_status' => 'completed',
            'closing_remarks' => 'Too early.',
        ])->assertUnprocessable();

        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url($id, 'acknowledge'))->assertOk();

        $this->postJson($this->url($id, 'close'), [
            'completion_status' => 'completed',
            'closing_remarks' => 'Planner cannot close.',
        ])->assertForbidden();

        $this->authenticateApiUser($this->user('Management'));
        $this->postJson($this->url($id, 'close'), [
            'completion_status' => 'completed',
            'closing_remarks' => 'Another manager cannot close.',
        ])->assertForbidden();

        $this->authenticateApiUser($this->manager);

        foreach (['completed', 'incomplete'] as $outcome) {
            $this->postJson($this->url($id, 'close'), [
                'completion_status' => $outcome,
                'closing_remarks' => '   ',
            ])->assertUnprocessable()
                ->assertJsonValidationErrors('closing_remarks');
        }

        $this->postJson($this->url($id, 'close'), [
            'completion_status' => 'incomplete',
            'closing_remarks' => 'Further work is required.',
        ])->assertOk()
            ->assertJsonPath('data.completion_status', 'incomplete');
    }

    public function test_planner_scope_and_administrative_admin_acknowledgement(): void
    {
        $id = $this->createComment();

        $this->authenticateApiUser($this->user('Planning Officer'));
        $this->getJson('/api/management-objective-comments')
            ->assertOk()
            ->assertJsonCount(0, 'data');
        $this->getJson($this->url($id))->assertForbidden();
        $this->postJson($this->url($id, 'acknowledge'))->assertForbidden();

        $admin = $this->user('Administrative Admin');
        $this->authenticateApiUser($admin);

        $this->getJson($this->url($id))
            ->assertOk()
            ->assertJsonPath('data.can_acknowledge', true);

        $this->postJson($this->url($id, 'acknowledge'))
            ->assertOk()
            ->assertJsonPath('data.acknowledged_by', $admin->user_id);
    }

    public function test_repeated_actions_cannot_overwrite_recorded_details(): void
    {
        $id = $this->createComment();
        $this->authenticateApiUser($this->planner);

        $this->postJson($this->url($id, 'acknowledge'))->assertOk();
        $acknowledged = ManagementObjectiveComment::findOrFail($id)
            ->getAttributes();

        $this->postJson($this->url($id, 'acknowledge'))
            ->assertUnprocessable();

        $this->assertSame(
            $acknowledged,
            ManagementObjectiveComment::findOrFail($id)->getAttributes()
        );

        $this->authenticateApiUser($this->manager);
        $this->postJson($this->url($id, 'close'), [
            'completion_status' => 'completed',
            'closing_remarks' => 'Verified.',
        ])->assertOk();

        $closed = ManagementObjectiveComment::findOrFail($id)->getAttributes();

        $this->postJson($this->url($id, 'close'), [
            'completion_status' => 'incomplete',
            'closing_remarks' => 'Attempted overwrite.',
        ])->assertUnprocessable();

        $this->assertSame(
            $closed,
            ManagementObjectiveComment::findOrFail($id)->getAttributes()
        );

        $this->authenticateApiUser($this->planner);
        $this->getJson($this->url($id))
            ->assertOk()
            ->assertJsonPath('data.completion_status', 'completed')
            ->assertJsonPath('data.closing_remarks', 'Verified.');
    }
}