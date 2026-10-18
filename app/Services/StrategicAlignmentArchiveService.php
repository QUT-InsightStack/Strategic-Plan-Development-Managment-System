<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use App\Repositories\StrategicAlignmentRepository;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class StrategicAlignmentArchiveService
{
    public function __construct(
        private readonly StrategicAlignmentRepository $alignments,
        private readonly StrategicObjectiveAlignmentService $alignmentService,
        private readonly StrategicPlanAuthorizationService $planAuthorization,
        private readonly PermissionAuthorizationService $permissions,
        private readonly StrategicLogWriter $logWriter,
    ) {}

    public function archive(int $objectiveId, string $type, int $referenceId, User $actor): array
    {
        // Route middleware also checks this; the service must not rely on it.
        $this->permissions->ensureHasPermission(
            'strategic_alignments.archive',
            $actor,
            'You are not authorized to archive strategic alignment mappings.'
        );

        $definition = $this->alignments->definition($type);

        return DB::transaction(function () use ($objectiveId, $type, $referenceId, $actor, $definition): array {
            $planId = StrategicObjective::query()
                ->whereKey($objectiveId)
                ->where('status', '!=', 'deleted')
                ->value('strategic_plan_id');

            if ($planId === null) {
                $this->notFound('Strategic objective not found.');
            }

            // Plan, objective, then mapping: the same parent-first order used
            // by alignment writes and plan submission. A submission cannot
            // snapshot this mapping while it is being archived.
            $plan = Strategic::with('creator')
                ->whereKey($planId)
                ->lockForUpdate()
                ->first();

            if (! $plan || $plan->status === 'deleted') {
                $this->notFound('Strategic objective not found.');
            }

            $objective = StrategicObjective::query()
                ->whereKey($objectiveId)
                ->where('strategic_plan_id', $planId)
                ->lockForUpdate()
                ->first();

            if (! $objective || $objective->status === 'deleted') {
                $this->notFound('Strategic objective not found.');
            }

            $this->planAuthorization->ensurePlanIsWithinAuthorizedScope(
                $plan,
                $actor,
                'You are not authorized to archive alignment mappings for this strategic objective.'
            );

            $mapping = $this->alignments->findForUpdate($type, $objectiveId, $referenceId);

            if (! $mapping) {
                $this->notFound('Strategic alignment mapping not found.');
            }

            if ($mapping->status === 'archived') {
                throw ValidationException::withMessages([
                    'status' => ['This Strategic Alignment mapping has already been archived.'],
                ]);
            }

            if ($objective->status === 'archived') {
                throw ValidationException::withMessages([
                    'status' => ['Archived objectives must be restored before their alignment mappings can be changed.'],
                ]);
            }

            $this->alignmentService->ensurePlanPermitsAlignmentChanges($plan);

            $archivedAt = now();
            $affected = $this->alignments->markArchived(
                $type,
                $objectiveId,
                $referenceId,
                $actor->user_id,
                $archivedAt
            );

            if ($affected !== 1) {
                // Unreachable while the row lock is held; rollback if violated.
                throw new RuntimeException('Strategic alignment mapping could not be archived.');
            }

            // Written in the same transaction: the archive and its audit row
            // commit together or not at all.
            $this->logWriter->write('strategic_alignment.archived', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'strategic_alignment',
                'resource_id' => $objectiveId,
                'objective_id' => $objectiveId,
                'plan_id' => $plan->record_id,
                'reference_type' => $definition['reference_type'],
                'reference_id' => $referenceId,
                'archived_at' => $archivedAt->toIso8601String(),
                'from' => 'active',
                'to' => 'archived',
            ]);

            return [
                'objective_id' => $objectiveId,
                'plan_id' => $plan->record_id,
                'reference_type' => $definition['reference_type'],
                'reference_id' => $referenceId,
                'status' => 'archived',
                'archived_at' => $archivedAt->toIso8601String(),
                'archived_by' => $actor->user_id,
            ];
        }, 3);
    }

    private function notFound(string $message): never
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => $message,
            'errors' => [],
        ], 404));
    }
}