<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\ImplementationInput;
use App\Models\ObjectiveComment;
use App\Models\ResponsibleUnit;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ObjectiveCollaborationService
{
    public function __construct(
        private readonly PermissionAuthorizationService $permissions,
        private readonly StrategicPlanAuthorizationService $plans,
        private readonly StrategicLogWriter $logWriter,
    ) {}

    public function addComment(int $objectiveId, string $content, User $actor): ObjectiveComment
    {
        $this->permissions->ensureHasPermission('objective_comments.create', $actor);

        return DB::transaction(function () use ($objectiveId, $content, $actor) {
            [$plan, $objective] = $this->context(null, $objectiveId, $actor, true);
            $unit = $this->authorizeUnit($plan, $objective, $actor, true);
            $this->ensureOpen($plan, $objective);
            $comment = ObjectiveComment::create([
                ...$this->submissionIdentity($unit, $actor),
                'objective_id' => $objective->objective_id,
                'content' => $content,
            ]);
            $this->audit('objective_comment.created', $comment->comment_id, $actor, $plan, $objective);

            return $comment;
        }, 3);
    }

    public function submitInput(?int $planId, ?int $objectiveId, array $data, User $actor): ImplementationInput
    {
        $this->permissions->ensureHasPermission('implementation_inputs.create', $actor);

        return DB::transaction(function () use ($planId, $objectiveId, $data, $actor) {
            $planLevelProposal = $objectiveId === null && $data['input_type'] === 'change_request';
            [$plan, $objective] = $this->context($planId, $objectiveId, $actor, true, $planLevelProposal);
            $unit = $this->authorizeUnit($plan, $objective, $actor, true, $planLevelProposal);
            $this->ensureOpen($plan, $objective);
            if ($data['input_type'] === 'change_request'
                && ($plan->status !== 'draft' || ($objective && $objective->status !== 'draft'))) {
                throw ValidationException::withMessages([
                    'input_type' => ['Changes cannot be proposed against finalized plans or published objectives. Submit implementation feedback instead.'],
                ]);
            }

            $input = ImplementationInput::create([
                ...$this->submissionIdentity($unit, $actor),
                'strategic_plan_id' => $plan->record_id,
                'objective_id' => $objective?->objective_id,
                'input_type' => $data['input_type'],
                'content' => $data['content'],
                'review_status' => ImplementationInput::PENDING_REVIEW,
            ]);
            $this->audit('implementation_input.submitted', $input->input_id, $actor, $plan, $objective);

            return $input;
        }, 3);
    }

    public function comments(int $objectiveId, int $perPage, User $actor): LengthAwarePaginator
    {
        [$plan, $objective] = $this->context(null, $objectiveId, $actor);
        $query = ObjectiveComment::where('objective_id', $objective->objective_id);
        if (! $this->canViewAll('objective_comments.view_all', $actor)) {
            $this->permissions->ensureHasPermission('objective_comments.create', $actor);
            $unit = $this->authorizeUnit($plan, $objective, $actor);
            $query->where('responsible_unit_id', $unit->responsible_unit_id);
        }

        return $query->orderBy('comment_id')->paginate($perPage);
    }

    private function canViewAll(string $permission, User $actor): bool
    {
        return $actor->role?->hasFullAccess()
            || $this->permissions->userPermissionCodes($actor)->contains($permission);
    }

    /** @return array{Strategic, ?StrategicObjective} */
    private function context(?int $planId, ?int $objectiveId, User $actor, bool $lock = false, bool $allowUnassignedPlan = false): array
    {
        if ($planId === null) {
            $planId = StrategicObjective::whereKey($objectiveId)->value('strategic_plan_id');
        }
        $plan = Strategic::whereKey($planId)->when($lock, fn ($q) => $q->lockForUpdate())->firstOrFail();
        abort_if($plan->status === 'deleted', 404, 'Strategic plan not found.');
        $this->plans->ensurePlanIsWithinAuthorizedScope($plan, $actor, 'You are not authorized to access this strategic plan.', $allowUnassignedPlan);
        $objective = $objectiveId === null ? null : StrategicObjective::whereKey($objectiveId)
            ->when($lock, fn ($q) => $q->lockForUpdate())->firstOrFail();
        abort_if($objective?->status === 'deleted', 404, 'Strategic objective not found.');
        if ($objective && (int) $objective->strategic_plan_id !== (int) $plan->record_id) {
            throw ValidationException::withMessages(['objective_id' => ['The objective must belong to the selected strategic plan.']]);
        }

        return [$plan, $objective];
    }

    private function authorizeUnit(Strategic $plan, ?StrategicObjective $objective, User $actor, bool $lock = false, bool $allowUnassignedPlan = false): ResponsibleUnit
    {
        // Office placement is maintained through the existing administrator API,
        // never from a submitted payload or a self-service profile edit.
        $user = User::whereKey($actor->user_id)->when($lock, fn ($q) => $q->lockForUpdate())->firstOrFail();
        $unit = ResponsibleUnit::where('name_key', ResponsibleUnit::nameKey($user->office ?? ''))
            ->where('is_active', true)->when($lock, fn ($q) => $q->lockForUpdate())->first();
        $scope = StrategicObjective::where('strategic_plan_id', $plan->record_id)
            ->whereNotIn('status', $lock && ! $objective ? ['archived', 'deleted'] : ['deleted'])
            ->whereHas('responsibleUnitAssignment', fn ($q) => $q->where('responsible_unit_id', $unit?->responsible_unit_id));
        if ($objective) {
            $scope->whereKey($objective->objective_id);
        }
        if ($user->status !== 'active' || ! $unit || (! $allowUnassignedPlan && ! $scope->exists())) {
            throw new AuthorizationException('Your office is not assigned to this strategic objective or plan.');
        }

        return $unit;
    }

    private function ensureOpen(Strategic $plan, ?StrategicObjective $objective): void
    {
        if (! in_array($plan->status, ['draft', 'finished'], true)
            || ($objective && ! in_array($objective->status, ['draft', 'published'], true))) {
            throw ValidationException::withMessages(['status' => ['This content is closed to new comments and implementation inputs.']]);
        }
    }

    private function submissionIdentity(ResponsibleUnit $unit, User $actor): array
    {
        return [
            'responsible_unit_id' => $unit->responsible_unit_id,
            'responsible_office_agency' => $unit->responsible_office_agency,
            'submitted_by' => $actor->user_id,
            'submitter_name' => $actor->name,
            'submitted_at' => now(),
        ];
    }

    private function audit(string $event, int $id, User $actor, Strategic $plan, ?StrategicObjective $objective): void
    {
        $this->logWriter->write($event, [
            'resource_type' => explode('.', $event)[0], 'resource_id' => $id,
            'actor_user_id' => $actor->user_id, 'strategic_plan_id' => $plan->record_id,
            'objective_id' => $objective?->objective_id,
        ]);
    }
}
