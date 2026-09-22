<?php

namespace App\Services;

use App\Models\ApprovalWorkflow;
use App\Models\ImplementationInput;
use App\Models\PlanSubmission;
use App\Models\PlanSubmissionStage;
use App\Models\Role;
use App\Models\Strategic;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PlanApprovalService
{
    public function __construct(private ApprovalWorkflowService $workflows, private StrategicPlanAuthorizationService $access) {}

    public function submit(int $planId, User $actor): PlanSubmission
    {
        abort_unless($actor->status === 'active' && in_array($actor->role?->role_name, ['Planning Officer', 'Administrator', 'test'], true),
            403, 'Only authorised Planning Officers may submit strategic plans.');

        return DB::transaction(function () use ($planId, $actor) {
            $workflow = ApprovalWorkflow::lockForUpdate()->findOrFail(1);
            $plan = Strategic::lockForUpdate()->findOrFail($planId);
            $this->access->ensureCanUpdatePlan($plan, $actor);
            abort_if($plan->approval_status === 'under_approval', 409, 'This plan is already under approval.');
            if ($workflow->status !== 'active') {
                throw ValidationException::withMessages(['workflow' => 'No active approval workflow exists. Contact a Technical Administrator before submitting.']);
            }
            // Revalidate on submission: users may have been deactivated since activation.
            $configuration = $workflow->load('stages')->toArray();
            $configuration['stages'] = $workflow->stages->map(fn ($stage) => $stage->only(['name', 'sequence', 'user_id', 'role_id']))->all();
            $this->workflows->validate($configuration);
            $plan->load([
                'creator:user_id,first_name,last_name,department,office', 'missionFoundation', 'visionFoundation', 'coreValues',
                'objectives' => fn ($query) => $query->whereNotIn('status', ['archived', 'deleted'])->orderBy('objective_id'),
                'objectives.pdpChapters', 'objectives.presidentialAgendaItems', 'objectives.responsibleUnitAssignment.responsibleUnit',
                'objectives.comments', 'objectives.documents', 'inputs', 'documents', 'parents',
            ]);
            $this->validatePlan($plan);
            // Keep the existing lifecycle and its database guards; approval has its own status.
            $plan->forceFill(['status' => 'finished', 'approval_status' => 'under_approval', 'updated_by' => $actor->user_id])->save();
            $snapshot = $plan->toArray();
            foreach ($snapshot['documents'] as &$document) {
                unset($document['stored_path']);
            }
            unset($document);
            foreach ($snapshot['objectives'] as &$objective) {
                foreach ($objective['documents'] as &$document) {
                    unset($document['stored_path']);
                }
                unset($document);
            }
            unset($objective);
            $submission = PlanSubmission::create([
                'plan_id' => $planId, 'workflow_id' => $workflow->id, 'workflow_version' => $workflow->version,
                'workflow_snapshot' => $configuration, 'plan_snapshot' => $snapshot,
                'submitted_by' => $actor->user_id, 'submitted_at' => now(),
                'status' => 'under_approval', 'current_sequence' => 1,
            ]);
            foreach ($workflow->stages as $stage) {
                $reviewers = $this->workflows->reviewers($stage->toArray());
                $instance = $submission->stages()->create([
                    'name' => $stage->name, 'sequence' => $stage->sequence,
                    'approver_type' => $stage->user_id ? 'user' : 'role',
                    'approver_id' => $stage->user_id ?: $stage->role_id,
                    'approver_label' => $stage->user_id ? $reviewers->first()->name : Role::findOrFail($stage->role_id)->role_name,
                    'status' => $stage->sequence === 1 ? 'current' : 'waiting',
                ]);
                foreach ($reviewers as $reviewer) {
                    $instance->reviewers()->attach($reviewer->user_id, ['reviewer_name' => $reviewer->name]);
                }
            }
            $first = $submission->stages()->first();
            $this->record($submission, $first, $actor, 'submitted');
            $this->record($submission, $first, $actor, 'stage_started');

            return $submission->load(['stages.reviewers', 'history']);
        });
    }

    private function validatePlan(Strategic $plan): void
    {
        $errors = [];
        if (! in_array($plan->status, ['draft', 'finished'], true) || $plan->level !== 'strategic_plan'
            || $plan->approval_status === 'approved') {
            $errors['plan'] = 'Only draft or finished strategic plans awaiting approval can be submitted.';
        }
        if (! trim($plan->title) || $plan->title === 'Untitled Strategic Plan') {
            $errors['title'] = 'A plan title is required before submission.';
        }
        if (! trim($plan->missionFoundation?->content ?? '') || ! trim($plan->visionFoundation?->content ?? '') || $plan->coreValues->isEmpty()) {
            $errors['foundations'] = 'Complete the mission, vision and core values before submitting.';
        }
        if ($plan->objectives->isEmpty() || $plan->objectives->contains(fn ($objective) => ! trim($objective->objective_title ?? '') || ! trim($objective->expected_outcome ?? '') || ! trim($objective->indicator ?? ''))) {
            $errors['objectives'] = 'Add strategic objectives with titles, expected outcomes and indicators before submitting.';
        }
        if ($plan->inputs->contains('review_status', ImplementationInput::PENDING_REVIEW)) {
            $errors['inputs'] = 'Review all pending implementation inputs before submitting.';
        }
        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    public function review(int $planId, User $actor): PlanSubmission
    {
        $submission = PlanSubmission::where('plan_id', $planId)->latest('id')->firstOrFail();
        $this->authorizeParticipant($submission, $actor);

        return $submission->load(['stages.reviewers', 'history']);
    }

    public function authorizeParticipant(PlanSubmission $submission, User $actor): void
    {
        abort_unless($actor->status === 'active' && ($submission->submitted_by === $actor->user_id
            || $submission->stages()->whereHas('reviewers', fn ($query) => $query->where('tblusers.user_id', $actor->user_id))->exists()),
            403, 'Only participants assigned to this approval workflow can review this submission.');
    }

    public function decide(int $planId, array $data, User $actor): PlanSubmission
    {
        return DB::transaction(function () use ($planId, $data, $actor) {
            $plan = Strategic::lockForUpdate()->findOrFail($planId);
            $submission = PlanSubmission::where('plan_id', $planId)->latest('id')->lockForUpdate()->firstOrFail();
            $this->authorizeParticipant($submission, $actor);
            abort_unless($submission->status === 'under_approval' && $submission->id === (int) $data['submission_id'],
                409, 'This approval submission is no longer current. Reload the review.');
            $stage = $submission->stages()->where('sequence', $submission->current_sequence)->firstOrFail();
            abort_unless($stage->id === (int) $data['stage_id'], 409, 'This stage has already been processed. Reload the review.');
            abort_unless($stage->reviewers()->where('tblusers.user_id', $actor->user_id)->exists(),
                403, 'Only a reviewer assigned to the current stage can decide.');
            $approved = $data['decision'] === 'approve';
            $stage->update(['status' => $approved ? 'approved' : 'rejected']);
            $this->record($submission, $stage, $actor, $approved ? 'approved' : 'rejected', $data['comment'] ?? null);
            $next = $approved ? $submission->stages()->where('sequence', $stage->sequence + 1)->first() : null;
            if ($next) {
                $next->update(['status' => 'current']);
                $submission->update(['current_sequence' => $next->sequence]);
                $this->record($submission, $next, $actor, 'stage_started');
            } else {
                $status = $approved ? 'approved' : 'rejected';
                $submission->update(['status' => $status, 'current_sequence' => null, 'completed_at' => now()]);
                $plan->forceFill(['approval_status' => $status])->save();
            }

            return $submission->load(['stages.reviewers', 'history']);
        });
    }

    private function record(PlanSubmission $submission, PlanSubmissionStage $stage, User $actor, string $action, ?string $comment = null): void
    {
        $submission->history()->create([
            'stage_id' => $stage->id, 'actor_id' => $actor->user_id, 'actor_name' => $actor->name,
            'action' => $action, 'comment' => $comment, 'created_at' => now(),
        ]);
    }
}
