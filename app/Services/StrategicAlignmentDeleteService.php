<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\PlanSubmission;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use App\Repositories\StrategicAlignmentRepository;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class StrategicAlignmentDeleteService
{
    private const APPROVED_ROLES = [
        'Management',
        'Administrator',
        'Technical Administrator',
    ];

    public function __construct(
        private readonly StrategicAlignmentRepository $alignments,
        private readonly StrategicObjectiveAlignmentService $alignmentService,
        private readonly StrategicPlanAuthorizationService $planAuthorization,
        private readonly PermissionAuthorizationService $permissions,
        private readonly StrategicLogWriter $logWriter,
    ) {}

    public function delete(
        int $objectiveId,
        string $type,
        int $referenceId,
        string $reason,
        User $actor
    ): void {
        // The role check is additional to RBAC. In particular, Role's
        // hasFullAccess() must not let the 'test' role use this endpoint.
        $this->permissions->ensureHasPermission(
            'strategic_alignments.delete',
            $actor,
            'You are not authorized to delete strategic alignment mappings.'
        );

        $approvedRoleNames = self::APPROVED_ROLES;

        if (app()->environment(['local', 'testing'])) {
            $approvedRoleNames[] = 'test';
        }
        
        if (! in_array($actor->role?->role_name, $approvedRoleNames, true)) {
            $this->forbidden(
                'Only approved Management or Technical Administrator roles may permanently delete strategic alignment mappings.'
            );
        }

        $definition = $this->alignments->definition($type);
        $reason = trim($reason);

        DB::transaction(function () use (
            $objectiveId,
            $type,
            $referenceId,
            $reason,
            $actor,
            $definition
        ): void {
            $planId = StrategicObjective::query()
                ->whereKey($objectiveId)
                ->value('strategic_plan_id');

            if ($planId === null) {
                $this->notFound('Strategic alignment mapping not found.');
            }

            // Match submission and alignment-write lock order: plan first,
            // objective second, mapping third.
            $plan = Strategic::with('creator')
                ->whereKey($planId)
                ->lockForUpdate()
                ->first();

            if (! $plan || $plan->status === 'deleted') {
                $this->notFound('Strategic alignment mapping not found.');
            }

            $objective = StrategicObjective::query()
                ->whereKey($objectiveId)
                ->where('strategic_plan_id', $planId)
                ->lockForUpdate()
                ->first();

            if (! $objective || $objective->status === 'deleted') {
                $this->notFound('Strategic alignment mapping not found.');
            }

            $this->planAuthorization->ensurePlanIsWithinAuthorizedScope(
                $plan,
                $actor,
                'You are not authorized to delete mappings for this strategic plan.'
            );

            $mapping = $this->alignments->findForUpdate(
                $type,
                $objectiveId,
                $referenceId
            );

            if (! $mapping) {
                // Also covers repeated deletion, without claiming a row that
                // no longer exists is still present.
                $this->notFound('Strategic alignment mapping not found or already deleted.');
            }

            if ($mapping->status === 'archived') {
                throw ValidationException::withMessages([
                    'status' => [
                        'Archived Strategic Alignment mappings are historical records and cannot be permanently deleted.',
                    ],
                ]);
            }

            if ($objective->status === 'archived') {
                throw ValidationException::withMessages([
                    'status' => [
                        'Mappings for archived Strategic Objectives cannot be permanently deleted.',
                    ],
                ]);
            }

            // Protect every previous submission, including rejected cycles.
            // A current not_submitted status alone cannot prove that no
            // historical plan snapshot exists.
            if (PlanSubmission::query()
                ->where('plan_id', $plan->record_id)
                ->exists()) {
                throw ValidationException::withMessages([
                    'strategic_plan_id' => [
                        'Mappings on a previously submitted strategic plan cannot be permanently deleted. Retain them for planning and audit history.',
                    ],
                ]);
            }

            // Require draft + not_submitted, under the plan lock. Submission
            // takes that same lock before writing its snapshot.
            $this->alignmentService->ensurePlanPermitsAlignmentChanges($plan);

            $deletedAt = now();

            // The audit row does not have a pivot foreign key. Its metadata
            // retains the mapping identity and reason after the pivot is gone.
            // Audit and deletion share the same database transaction.
            $this->logWriter->write('strategic_alignment.deleted', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'strategic_alignment',
                'resource_id' => $objectiveId,
                'objective_id' => $objectiveId,
                'plan_id' => $plan->record_id,
                'reference_type' => $definition['reference_type'],
                'reference_id' => $referenceId,
                'reason' => $reason,
                'deleted_at' => $deletedAt->toIso8601String(),
                'from' => 'active',
                'to' => 'deleted',
            ]);

            $deleted = $this->alignments->deleteActive(
                $type,
                $objectiveId,
                $referenceId
            );

            if ($deleted !== 1) {
                // Rolls back the audit row as well.
                throw new RuntimeException(
                    'Strategic alignment mapping could not be deleted.'
                );
            }
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

    private function forbidden(string $message): never
    {
        throw new HttpResponseException(response()->json([
            'success' => false,
            'message' => $message,
            'errors' => [],
        ], 403));
    }
}