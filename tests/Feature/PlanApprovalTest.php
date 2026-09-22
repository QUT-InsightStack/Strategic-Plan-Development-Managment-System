<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\PlanSubmission;
use App\Models\PlanWorkflowHistory;
use App\Models\Role;
use App\Models\Strategic;
use App\Models\StrategicDocument;
use App\Models\StrategicObjective;
use App\Models\User;
use App\Models\WorkflowNotification;
use App\Services\PlanApprovalService;
use App\Services\PlanCreationService;
use App\Services\WorkflowNotificationService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PlanApprovalTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private User $planner;

    private User $reviewer;

    private User $finalReviewer;

    private Strategic $plan;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = $this->user('Technical Administrator');
        $this->planner = $this->user('Planning Officer');
        $this->reviewer = $this->user('First Reviewer');
        $this->finalReviewer = $this->user('Final Reviewer');
        $permission = Permission::firstOrCreate(['code' => 'strategic_records.update'], [
            'permission_name' => 'Update Plans', 'module' => 'strategic_records',
        ]);
        $this->planner->role->permissions()->attach($permission->permission_id);
        $this->plan = app(PlanCreationService::class)->create([
            'title' => 'Research Strategy', 'level' => 'strategic_plan', 'mission' => 'Research for all',
            'vision' => 'Better outcomes', 'core_values' => ['Integrity'], 'status' => 'draft',
        ], $this->planner);
        StrategicObjective::create([
            'strategic_plan_id' => $this->plan->record_id, 'created_by' => $this->planner->user_id,
            'objective_title' => 'Improve access', 'expected_outcome' => 'More participation',
            'indicator' => 'Participant count', 'status' => 'draft',
        ]);
    }

    public function test_workflow_and_review_endpoints_require_authentication(): void
    {
        $this->getJson('/api/approval-workflow')->assertUnauthorized();
        $this->putJson('/api/approval-workflow', $this->configuration())->assertUnauthorized();
        $this->postJson($this->url('submit'))->assertUnauthorized();
        $this->getJson($this->url('approval'))->assertUnauthorized();
        $this->getJson('/api/plan-reviews')->assertUnauthorized();
        $this->postJson($this->url('resubmit'), ['previous_submission_id' => 1])->assertUnauthorized();
        $this->getJson($this->url('approval-status'))->assertUnauthorized();
        $this->getJson('/api/workflow-notifications')->assertUnauthorized();
        $this->patchJson('/api/workflow-notifications/1/read')->assertUnauthorized();
    }

    public function test_only_administrators_can_read_or_save_workflows(): void
    {
        $this->authenticateApiUser($this->planner);
        $this->getJson('/api/approval-workflow')->assertForbidden();
        $this->putJson('/api/approval-workflow', $this->configuration())->assertForbidden();
        $this->assertDatabaseCount('approval_workflow_stages', 0);
        $this->configure();
        $this->getJson('/api/approval-workflow')->assertOk()->assertJsonPath('data.version', 1)
            ->assertJsonPath('data.stages.0.sequence', 1)->assertJsonPath('data.stages.1.role_id', $this->finalReviewer->role_id);
        $this->assertDatabaseHas('approval_workflow_stages', ['sequence' => 1, 'user_id' => $this->reviewer->user_id]);
    }

    public function test_invalid_configurations_cannot_be_saved_or_activated_and_updates_are_atomic(): void
    {
        $this->configure();
        $valid = $this->configuration();
        $valid['stages'] = array_reverse($valid['stages']);
        $valid['version'] = 1;
        $invalid = [];
        $invalid[] = array_replace($valid, ['stages' => []]);
        $invalid[] = array_replace($valid, ['name' => '   ']);
        foreach (['duplicate', 'gap', 'missing', 'both', 'unknown', 'empty_role', 'blank_stage'] as $case) {
            $data = $valid;
            match ($case) {
                'duplicate' => $data['stages'][1]['sequence'] = 1,
                'gap' => $data['stages'][1]['sequence'] = 3,
                'missing' => $data['stages'][0]['user_id'] = null,
                'both' => $data['stages'][0]['role_id'] = $this->reviewer->role_id,
                'unknown' => $data['stages'][0]['user_id'] = 999999,
                'empty_role' => $data['stages'][1]['role_id'] = Role::create(['role_name' => 'Empty'])->role_id,
                'blank_stage' => $data['stages'][0]['name'] = ' ',
            };
            $invalid[] = $data;
        }
        foreach ($invalid as $data) {
            $this->putJson('/api/approval-workflow', $data)->assertUnprocessable();
            $this->assertDatabaseHas('approval_workflows', ['id' => 1, 'status' => 'active', 'version' => 1]);
            $this->assertDatabaseCount('approval_workflow_stages', 2);
        }
        $this->putJson('/api/approval-workflow', $this->configuration())->assertConflict();
    }

    public function test_no_active_workflow_blocks_submission_without_side_effects(): void
    {
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url('submit'))->assertUnprocessable()->assertJsonValidationErrors('workflow');
        $this->assertSame('not_submitted', $this->plan->refresh()->approval_status);
        $this->assertSame('draft', $this->plan->status);
        $this->assertDatabaseCount('plan_submissions', 0);
    }

    public function test_ineligible_or_unauthorised_plans_cannot_be_submitted(): void
    {
        $this->configure();
        $this->authenticateApiUser($this->reviewer);
        $this->postJson($this->url('submit'))->assertForbidden();
        $this->authenticateApiUser($this->planner);
        $this->plan->objectives()->update(['indicator' => '']);
        $this->postJson($this->url('submit'))->assertUnprocessable()->assertJsonValidationErrors('objectives');
        $this->assertDatabaseCount('plan_submissions', 0);
        $this->assertSame('draft', $this->plan->refresh()->status);
    }

    public function test_submission_revalidates_active_approvers(): void
    {
        $this->configure();
        $this->reviewer->update(['status' => 'inactive']);
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url('submit'))->assertUnprocessable();
        $this->assertDatabaseCount('plan_submissions', 0);
    }

    public function test_preparation_is_available_to_planners_without_input_scope_and_blocks_other_roles(): void
    {
        $this->authenticateApiUser($this->planner);
        $this->getJson($this->url('approval-preparation'))->assertOk()->assertJsonPath('data.pending_inputs', 0);
        $this->authenticateApiUser($this->reviewer);
        $this->getJson($this->url('approval-preparation'))->assertForbidden();
    }

    public function test_deactivation_blocks_new_submissions_but_preserves_current_reviews(): void
    {
        $submission = $this->submit();
        $this->authenticateApiUser($this->admin);
        $configuration = $this->configuration();
        $configuration['version'] = 1;
        $configuration['status'] = 'inactive';
        $this->putJson('/api/approval-workflow', $configuration)->assertOk();
        $copy = app(PlanCreationService::class)->copy($this->plan, $this->planner);
        $this->authenticateApiUser($this->planner);
        $this->postJson('/api/strategic-plans/'.$copy->record_id.'/submit')->assertUnprocessable()->assertJsonValidationErrors('workflow');
        $this->authenticateApiUser($this->reviewer);
        $this->postJson($this->url('approval/decision'), [
            'submission_id' => $submission['id'], 'stage_id' => $submission['stages'][0]['id'], 'decision' => 'approve',
        ])->assertOk()->assertJsonPath('data.current_sequence', 2);
        $this->reviewer->update(['status' => 'inactive']);
        auth('api')->forgetUser();
        $this->getJson($this->url('approval'))->assertUnauthorized();
    }

    public function test_submission_records_initial_stage_history_and_prevents_duplicates(): void
    {
        $submission = $this->submit();
        $this->assertSame('under_approval', $this->plan->refresh()->approval_status);
        $this->assertSame('finished', $this->plan->status);
        $this->assertSame(1, $submission['current_sequence']);
        $this->assertSame('First review', $submission['stages'][0]['name']);
        $this->assertSame($this->reviewer->user_id, $submission['stages'][0]['reviewers'][0]['user_id']);
        $this->assertDatabaseHas('plan_workflow_history', ['submission_id' => $submission['id'], 'action' => 'submitted']);
        $this->assertDatabaseHas('plan_workflow_history', ['submission_id' => $submission['id'], 'action' => 'stage_started']);
        $this->postJson($this->url('submit'))->assertConflict();
        $this->assertDatabaseCount('plan_submissions', 1);
    }

    public function test_configuration_plan_and_role_changes_do_not_change_existing_submission(): void
    {
        $submission = $this->submit();
        $this->plan->update(['title' => 'A later title']);
        $newMember = $this->user('Final Reviewer');
        $this->finalReviewer->update(['role_id' => $this->reviewer->role_id]);
        $this->authenticateApiUser($this->admin);
        $data = $this->configuration();
        $data['version'] = 1;
        $data['stages'] = [['name' => 'Replacement', 'sequence' => 1, 'user_id' => $this->admin->user_id]];
        $this->putJson('/api/approval-workflow', $data)->assertOk();
        $this->authenticateApiUser($this->reviewer);
        $this->getJson($this->url('approval'))->assertOk()->assertJsonPath('data.workflow_version', 1)
            ->assertJsonPath('data.plan_snapshot.title', 'Research Strategy')
            ->assertJsonPath('data.stages.1.reviewers.0.user_id', $this->finalReviewer->user_id);
        $this->authenticateApiUser($newMember);
        $this->getJson($this->url('approval'))->assertForbidden();
        $this->assertEquals($submission['workflow_snapshot'], PlanSubmission::first()->workflow_snapshot);
    }

    public function test_only_participants_can_review_and_only_current_assignees_see_the_queue(): void
    {
        $this->submit();
        $this->authenticateApiUser($this->admin);
        $this->getJson($this->url('approval'))->assertForbidden();
        $this->getJson('/api/plan-reviews')->assertOk()->assertJsonCount(0, 'data');
        $this->authenticateApiUser($this->reviewer);
        $this->getJson($this->url('approval'))->assertOk()->assertJsonPath('data.plan_snapshot.objectives.0.indicator', 'Participant count');
        $this->getJson('/api/plan-reviews')->assertOk()->assertJsonCount(1, 'data');
        $this->authenticateApiUser($this->finalReviewer);
        $this->getJson($this->url('approval'))->assertOk();
        $this->getJson('/api/plan-reviews')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_stages_advance_in_order_and_stale_or_unauthorised_decisions_are_rejected(): void
    {
        $submission = $this->submit();
        $decision = ['submission_id' => $submission['id'], 'stage_id' => $submission['stages'][0]['id'], 'decision' => 'approve'];
        $this->authenticateApiUser($this->finalReviewer);
        $this->postJson($this->url('approval/decision'), $decision)->assertForbidden();
        $this->authenticateApiUser($this->reviewer);
        $this->postJson($this->url('approval/decision'), $decision)->assertOk()->assertJsonPath('data.current_sequence', 2);
        $this->postJson($this->url('approval/decision'), $decision)->assertConflict();
        $this->authenticateApiUser($this->finalReviewer);
        $this->getJson('/api/plan-reviews')->assertOk()->assertJsonCount(1, 'data');
        $decision['stage_id'] = $submission['stages'][1]['id'];
        $this->postJson($this->url('approval/decision'), $decision)->assertOk()
            ->assertJsonPath('data.status', 'approved')->assertJsonPath('data.current_sequence', null);
        $this->assertSame('approved', $this->plan->refresh()->approval_status);
        $this->postJson($this->url('approval/decision'), $decision)->assertConflict();
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url('submit'))->assertUnprocessable();
    }

    public function test_rejection_requires_a_reason_and_resubmission_creates_a_new_cycle(): void
    {
        $submission = $this->submit();
        $this->authenticateApiUser($this->reviewer);
        $data = ['submission_id' => $submission['id'], 'stage_id' => $submission['stages'][0]['id'], 'decision' => 'reject'];
        $this->postJson($this->url('approval/decision'), $data)->assertUnprocessable();
        $this->postJson($this->url('approval/decision'), $data + ['comment' => 'Clarify targets'])->assertOk()->assertJsonPath('data.status', 'rejected');
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url('resubmit'), ['previous_submission_id' => $submission['id']])->assertCreated()->assertJsonPath('data.current_sequence', 1);
        $this->assertDatabaseCount('plan_submissions', 2);
        $this->assertDatabaseHas('plan_workflow_history', ['submission_id' => $submission['id'], 'comment' => 'Clarify targets']);
    }

    public function test_resubmission_requires_the_latest_rejected_state_and_cannot_use_initial_submission_endpoint(): void
    {
        $this->configure();
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url('resubmit'), ['previous_submission_id' => 1])->assertConflict();
        $submission = $this->postJson($this->url('submit'))->assertCreated()->json('data');
        $this->postJson($this->url('resubmit'), ['previous_submission_id' => $submission['id']])->assertConflict();
        $this->reject($submission);
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url('submit'))->assertUnprocessable();
        $this->postJson($this->url('resubmit'), [])->assertUnprocessable();
        $this->postJson($this->url('resubmit'), ['previous_submission_id' => $submission['id'] + 1])->assertConflict();
        $this->authenticateApiUser($this->reviewer);
        $this->postJson($this->url('resubmit'), ['previous_submission_id' => $submission['id']])->assertForbidden();
        $this->assertDatabaseCount('plan_submissions', 1);
    }

    public function test_resubmission_revalidates_revisions_and_preserves_rejection_while_using_the_active_workflow(): void
    {
        $submission = $this->submit();
        $this->reject($submission);
        $this->plan->objectives()->update(['indicator' => '']);
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url('resubmit'), ['previous_submission_id' => $submission['id']])
            ->assertUnprocessable()->assertJsonValidationErrors('objectives');
        $this->assertDatabaseCount('plan_submissions', 1);
        $this->assertSame('rejected', $this->plan->refresh()->approval_status);
        $this->plan->objectives()->update(['indicator' => 'Revised count']);
        $this->plan->update(['title' => 'Revised research strategy']);
        $this->authenticateApiUser($this->admin);
        $configuration = $this->configuration();
        $configuration['version'] = 1;
        $configuration['stages'] = [['sequence' => 1, 'name' => 'Updated first stage', 'user_id' => $this->finalReviewer->user_id]];
        $this->putJson('/api/approval-workflow', $configuration)->assertOk();
        $this->authenticateApiUser($this->planner);
        $new = $this->postJson($this->url('resubmit'), ['previous_submission_id' => $submission['id'], 'revision_note' => 'Added measurable indicators'])
            ->assertCreated()->assertJsonPath('data.workflow_version', 2)->assertJsonPath('data.current_sequence', 1)
            ->assertJsonPath('data.stages.0.name', 'Updated first stage')
            ->assertJsonPath('data.stages.0.reviewers.0.user_id', $this->finalReviewer->user_id)->json('data');
        $this->assertSame('under_approval', $this->plan->refresh()->approval_status);
        $this->assertDatabaseHas('plan_submissions', ['id' => $new['id'], 'previous_submission_id' => $submission['id']]);
        $this->assertDatabaseHas('plan_workflow_history', ['submission_id' => $new['id'], 'action' => 'resubmitted', 'comment' => 'Added measurable indicators']);
        $original = PlanSubmission::findOrFail($submission['id']);
        $this->assertSame('rejected', $original->status);
        $this->assertSame('Research Strategy', $original->plan_snapshot['title']);
        $this->assertSame('Revised research strategy', $new['plan_snapshot']['title']);
        $this->assertDatabaseHas('plan_workflow_history', ['submission_id' => $original->id, 'action' => 'rejected', 'comment' => 'Clarify targets']);
    }

    public function test_duplicate_or_old_resubmission_requests_cannot_start_an_extra_cycle(): void
    {
        $first = $this->submit();
        $this->reject($first);
        $this->authenticateApiUser($this->planner);
        $payload = ['previous_submission_id' => $first['id']];
        $second = $this->postJson($this->url('resubmit'), $payload)->assertCreated()->json('data');
        $this->postJson($this->url('resubmit'), $payload)->assertConflict();
        $this->reject($second);
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url('resubmit'), $payload)->assertConflict();
        $this->assertDatabaseCount('plan_submissions', 2);
        $this->assertSame(1, PlanWorkflowHistory::where('action', 'resubmitted')->count());
    }

    public function test_archived_rejected_plan_cannot_be_resubmitted(): void
    {
        $submission = $this->submit();
        $this->reject($submission);
        app(PlanCreationService::class)->updateStatus($this->plan->refresh(), 'archived', $this->planner);
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url('resubmit'), ['previous_submission_id' => $submission['id']])->assertUnprocessable();
        $this->assertDatabaseCount('plan_submissions', 1);
    }

    public function test_tracking_returns_ordered_history_across_cycles_and_current_assignments(): void
    {
        $first = $this->submit();
        $this->reject($first);
        $this->authenticateApiUser($this->planner);
        $second = $this->postJson($this->url('resubmit'), ['previous_submission_id' => $first['id']])->assertCreated()->json('data');
        $response = $this->getJson($this->url('approval-status'))->assertOk()
            ->assertJsonPath('data.status', 'under_approval')->assertJsonPath('data.current_submission.id', $second['id'])
            ->assertJsonPath('data.current_stage.sequence', 1)->assertJsonPath('data.current_stage.reviewers.0.user_id', $this->reviewer->user_id)
            ->assertJsonCount(2, 'data.cycles')->assertJsonCount(5, 'data.history');
        $this->assertSame(['submitted', 'stage_started', 'rejected', 'resubmitted', 'stage_started'], array_column($response->json('data.history'), 'action'));
        $ids = array_column($response->json('data.history'), 'id');
        $sorted = $ids;
        sort($sorted);
        $this->assertSame($sorted, $ids);
        $this->authenticateApiUser($this->reviewer);
        $this->postJson($this->url('approval/decision'), ['submission_id' => $second['id'], 'stage_id' => $second['stages'][0]['id'], 'decision' => 'approve'])->assertOk();
        $this->authenticateApiUser($this->planner);
        $this->getJson($this->url('approval-status'))->assertOk()->assertJsonPath('data.current_stage.sequence', 2)
            ->assertJsonPath('data.current_stage.reviewers.0.user_id', $this->finalReviewer->user_id)->assertJsonCount(7, 'data.history');
    }

    public function test_tracking_is_restricted_and_new_reviewers_do_not_receive_unassigned_past_cycles(): void
    {
        $first = $this->submit();
        $this->reject($first);
        $outsider = $this->user('Unrelated viewer');
        $this->authenticateApiUser($outsider);
        $this->getJson($this->url('approval-status'))->assertForbidden();
        $this->authenticateApiUser($this->admin);
        $this->getJson($this->url('approval-status'))->assertForbidden();
        $configuration = $this->configuration();
        $configuration['version'] = 1;
        $configuration['stages'] = [['name' => 'New reviewer', 'sequence' => 1, 'user_id' => $outsider->user_id]];
        $this->putJson('/api/approval-workflow', $configuration)->assertOk();
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url('resubmit'), ['previous_submission_id' => $first['id']])->assertCreated();
        $this->authenticateApiUser($outsider);
        $this->getJson($this->url('approval-status'))->assertOk()->assertJsonCount(1, 'data.cycles')->assertJsonCount(2, 'data.history');
        $this->authenticateApiUser($this->reviewer);
        $this->getJson($this->url('approval-status'))->assertForbidden();
    }

    public function test_events_notify_submitter_current_reviewers_and_next_stage_without_duplicates(): void
    {
        $submission = $this->submit();
        $submitted = PlanWorkflowHistory::where('action', 'submitted')->firstOrFail();
        $this->assertEqualsCanonicalizing([$this->planner->user_id, $this->reviewer->user_id], WorkflowNotification::where('event_id', $submitted->id)->pluck('recipient_id')->all());
        $this->authenticateApiUser($this->reviewer);
        $this->postJson($this->url('approval/decision'), ['submission_id' => $submission['id'], 'stage_id' => $submission['stages'][0]['id'], 'decision' => 'approve'])->assertOk();
        $approved = PlanWorkflowHistory::where('action', 'approved')->firstOrFail();
        $this->assertEqualsCanonicalizing([$this->planner->user_id, $this->reviewer->user_id, $this->finalReviewer->user_id], WorkflowNotification::where('event_id', $approved->id)->pluck('recipient_id')->all());
        $this->authenticateApiUser($this->finalReviewer);
        $this->postJson($this->url('approval/decision'), ['submission_id' => $submission['id'], 'stage_id' => $submission['stages'][1]['id'], 'decision' => 'reject', 'comment' => 'Clarify targets'])->assertOk();
        $rejected = PlanWorkflowHistory::where('action', 'rejected')->firstOrFail();
        $this->assertEqualsCanonicalizing([$this->planner->user_id, $this->finalReviewer->user_id], WorkflowNotification::where('event_id', $rejected->id)->pluck('recipient_id')->all());
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url('resubmit'), ['previous_submission_id' => $submission['id']])->assertCreated();
        $resubmitted = PlanWorkflowHistory::where('action', 'resubmitted')->firstOrFail();
        $this->assertEqualsCanonicalizing([$this->planner->user_id, $this->reviewer->user_id], WorkflowNotification::where('event_id', $resubmitted->id)->pluck('recipient_id')->all());
        $this->assertDatabaseCount('workflow_notifications', 9);
        $this->assertSame(9, WorkflowNotification::where('status', 'sent')->count());
        foreach (WorkflowNotification::all() as $notification) {
            $this->assertSame($this->plan->record_id, $notification->plan_id);
            $this->assertSame($notification->submission_id, $notification->event->submission_id);
            $this->assertNotNull($notification->sent_at);
        }
        app(WorkflowNotificationService::class)->recordEvent($submitted, PlanSubmission::findOrFail($submission['id']));
        $this->assertDatabaseCount('workflow_notifications', 9);
    }

    public function test_event_recipient_unique_constraint_and_recipient_overlap(): void
    {
        $this->authenticateApiUser($this->admin);
        $configuration = $this->configuration();
        $configuration['stages'] = [['name' => 'Planner review', 'sequence' => 1, 'user_id' => $this->planner->user_id]];
        $this->putJson('/api/approval-workflow', $configuration)->assertOk();
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url('submit'))->assertCreated();
        $this->assertDatabaseCount('workflow_notifications', 1);
        $notification = WorkflowNotification::firstOrFail();
        $this->expectException(QueryException::class);
        $notification->replicate()->save();
    }

    public function test_final_approval_notifies_the_submitter_and_final_reviewers_and_cannot_be_resubmitted(): void
    {
        $submission = $this->submit();
        foreach ([$this->reviewer, $this->finalReviewer] as $index => $reviewer) {
            $this->authenticateApiUser($reviewer);
            $this->postJson($this->url('approval/decision'), [
                'submission_id' => $submission['id'], 'stage_id' => $submission['stages'][$index]['id'], 'decision' => 'approve',
            ])->assertOk();
        }
        $event = PlanWorkflowHistory::where('action', 'approved')->latest('id')->firstOrFail();
        $this->assertEqualsCanonicalizing([$this->planner->user_id, $this->finalReviewer->user_id], WorkflowNotification::where('event_id', $event->id)->pluck('recipient_id')->all());
        $this->authenticateApiUser($this->planner);
        $this->getJson($this->url('approval-status'))->assertOk()->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.current_stage', null)->assertJsonPath('data.can_resubmit', false);
        $this->postJson($this->url('resubmit'), ['previous_submission_id' => $submission['id']])->assertConflict();
        $this->assertDatabaseCount('workflow_notifications', 7);
        $this->assertDatabaseCount('plan_submissions', 1);
    }

    public function test_resubmission_requires_an_active_valid_workflow_without_changing_the_rejected_cycle(): void
    {
        $submission = $this->submit();
        $this->reject($submission);
        $this->authenticateApiUser($this->admin);
        $configuration = $this->configuration();
        $configuration['version'] = 1;
        $configuration['status'] = 'inactive';
        $this->putJson('/api/approval-workflow', $configuration)->assertOk();
        $this->authenticateApiUser($this->planner);
        $this->postJson($this->url('resubmit'), ['previous_submission_id' => $submission['id']])
            ->assertUnprocessable()->assertJsonValidationErrors('workflow');
        $this->assertSame('rejected', $this->plan->refresh()->approval_status);
        $this->assertDatabaseCount('plan_submissions', 1);
        $this->assertDatabaseCount('workflow_notifications', 4);
    }

    public function test_notification_failure_does_not_fail_submission_and_retry_is_idempotent(): void
    {
        $service = \Mockery::mock(WorkflowNotificationService::class)->makePartial()->shouldAllowMockingProtectedMethods();
        $service->shouldReceive('publish')->andThrow(new \RuntimeException('Simulated delivery failure'));
        $this->app->instance(WorkflowNotificationService::class, $service);
        $submission = $this->submit();
        $this->assertSame('under_approval', $this->plan->refresh()->approval_status);
        $this->assertSame(2, WorkflowNotification::where('status', 'failed')->where('attempts', 1)->count());
        $this->assertDatabaseHas('plan_workflow_history', ['submission_id' => $submission['id'], 'action' => 'submitted']);
        $this->app->instance(WorkflowNotificationService::class, new WorkflowNotificationService);
        $this->travel(2)->minutes();
        $this->artisan('workflow:deliver-notifications')->assertSuccessful();
        $this->assertSame(2, WorkflowNotification::where('status', 'sent')->where('attempts', 2)->whereNull('last_error')->count());
        $this->artisan('workflow:deliver-notifications')->assertSuccessful();
        $this->assertDatabaseCount('workflow_notifications', 2);
        $this->assertSame(2, WorkflowNotification::where('attempts', 2)->count());
    }

    public function test_rolled_back_workflow_does_not_publish_notifications(): void
    {
        $this->configure();
        DB::beginTransaction();
        try {
            app(PlanApprovalService::class)->submit($this->plan->record_id, $this->planner);
            $this->assertSame(2, WorkflowNotification::where('status', 'pending')->count());
            $this->assertSame(0, WorkflowNotification::where('status', 'sent')->count());
        } finally {
            DB::rollBack();
        }
        $this->assertDatabaseCount('workflow_notifications', 0);
        $this->assertDatabaseCount('plan_submissions', 0);
        $this->assertSame('not_submitted', $this->plan->refresh()->approval_status);
    }

    public function test_inbox_and_read_receipts_are_recipient_scoped_and_idempotent(): void
    {
        $this->submit();
        $this->getJson('/api/workflow-notifications')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('unread_count', 1);
        $notification = WorkflowNotification::where('recipient_id', $this->planner->user_id)->firstOrFail();
        $other = WorkflowNotification::where('recipient_id', $this->reviewer->user_id)->firstOrFail();
        $this->patchJson('/api/workflow-notifications/'.$other->id.'/read')->assertNotFound();
        $this->patchJson('/api/workflow-notifications/'.$notification->id.'/read')->assertOk();
        $readAt = $notification->refresh()->read_at->toIso8601String();
        $this->travel(1)->minutes();
        $this->patchJson('/api/workflow-notifications/'.$notification->id.'/read')->assertOk();
        $this->assertSame($readAt, $notification->refresh()->read_at->toIso8601String());
        $this->getJson('/api/workflow-notifications')->assertOk()->assertJsonPath('unread_count', 0);
        $this->assertNull($other->refresh()->read_at);
    }

    private function reject(array $submission): void
    {
        $this->authenticateApiUser($this->reviewer);
        $this->postJson($this->url('approval/decision'), [
            'submission_id' => $submission['id'], 'stage_id' => $submission['stages'][0]['id'],
            'decision' => 'reject', 'comment' => 'Clarify targets',
        ])->assertOk();
    }

    public function test_review_documents_are_limited_to_submitted_attachments_and_participants(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('strategic-documents/test.txt', 'submitted information');
        $document = StrategicDocument::create([
            'strategic_plan_id' => $this->plan->record_id, 'uploaded_by' => $this->planner->user_id,
            'original_filename' => 'information.txt', 'stored_path' => 'strategic-documents/test.txt',
            'mime_type' => 'text/plain', 'extension' => 'txt', 'size_bytes' => 21,
            'sha256' => hash('sha256', 'submitted information'),
        ]);
        $submission = $this->submit();
        $url = '/api/plan-submissions/'.$submission['id'].'/documents/'.$document->document_id;
        $this->authenticateApiUser($this->reviewer);
        $this->getJson($this->url('approval'))->assertOk()->assertJsonMissingPath('data.plan_snapshot.documents.0.stored_path');
        $this->get($url)->assertOk()->assertDownload('information.txt');
        $this->get($url.'999')->assertNotFound();
        $this->authenticateApiUser($this->admin);
        $this->getJson($url)->assertForbidden();
    }

    private function configure(): void
    {
        $this->authenticateApiUser($this->admin);
        $this->putJson('/api/approval-workflow', $this->configuration())->assertOk();
    }

    private function submit(): array
    {
        $this->configure();
        $this->authenticateApiUser($this->planner);

        return $this->postJson($this->url('submit'))->assertCreated()->json('data');
    }

    private function configuration(): array
    {
        // Deliberately reversed array order: persisted sequence determines execution.
        return ['name' => 'Plan approval', 'status' => 'active', 'version' => 0, 'stages' => [
            ['name' => 'Final review', 'sequence' => 2, 'role_id' => $this->finalReviewer->role_id],
            ['name' => 'First review', 'sequence' => 1, 'user_id' => $this->reviewer->user_id],
        ]];
    }

    private function user(string $role): User
    {
        $role = Role::firstOrCreate(['role_name' => $role]);

        return User::create(['first_name' => $role->role_name, 'last_name' => 'User', 'email' => fake()->unique()->safeEmail(),
            'password' => 'password', 'role_id' => $role->role_id, 'status' => 'active']);
    }

    private function url(string $suffix): string
    {
        return '/api/strategic-plans/'.$this->plan->record_id.'/'.$suffix;
    }
}
