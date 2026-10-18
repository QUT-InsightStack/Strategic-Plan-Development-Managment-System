<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\StrategicDocument;
use App\Models\User;
use App\Repositories\StrategicAlignmentRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StrategicAlignmentLifecycleService
{
    public function __construct(
        private StrategicAlignmentRepository $repository,
        private StrategicObjectiveAlignmentService $alignments,
        private StrategicPlanAuthorizationService $plans,
        private PermissionAuthorizationService $permissions,
        private StrategicLogWriter $log,
    ) {}

    public function restore(int $id, string $type, int $referenceId, User $actor): array
    {
        $this->permissions->ensureHasPermission('strategic_alignments.archive', $actor);
        return $this->change($id, $type, $referenceId, $actor, function ($mapping) {
            if ($mapping->status !== 'archived') {
                throw ValidationException::withMessages(['status' => ['Only archived mappings can be restored.']]);
            }
            return ['status' => 'active', 'archived_at' => null, 'archived_by' => null];
        }, 'strategic_alignment.restored');
    }

    public function reference(int $id, string $type, int $referenceId, array $data, User $actor): array
    {
        $this->permissions->ensureHasPermission('strategic_objectives.update', $actor);
        return $this->change($id, $type, $referenceId, $actor, function ($mapping, $objective) use ($data, $actor) {
            if ($mapping->status !== 'active') {
                throw ValidationException::withMessages(['status' => ['Restore this mapping before editing its reference.']]);
            }
            if (! empty($data['document_id'])) {
                $this->permissions->ensureHasPermission('strategic_documents.view', $actor);
                $document = StrategicDocument::findOrFail($data['document_id']);
                if ((int) $document->strategic_plan_id !== (int) $objective->strategic_plan_id
                    && (int) $document->objective_id !== (int) $objective->objective_id) {
                    throw ValidationException::withMessages(['document_id' => ['Choose a document belonging to this plan or objective.']]);
                }
            }
            return ['reference_details' => json_encode($data, JSON_THROW_ON_ERROR)];
        }, 'strategic_alignment.reference_updated');
    }

    private function change(int $id, string $type, int $referenceId, User $actor, callable $values, string $event): array
    {
        $definition = $this->repository->definition($type);
        return DB::transaction(function () use ($id, $type, $referenceId, $actor, $values, $event, $definition) {
            $planId = StrategicObjective::whereKey($id)->value('strategic_plan_id');
            abort_if($planId === null, 404);
            $plan = Strategic::lockForUpdate()->findOrFail($planId);
            $objective = StrategicObjective::where('strategic_plan_id', $planId)->lockForUpdate()->findOrFail($id);
            abort_if($plan->status === 'deleted' || $objective->status === 'deleted', 404);
            $this->plans->ensurePlanIsWithinAuthorizedScope($plan, $actor);
            $this->alignments->ensurePlanPermitsAlignmentChanges($plan);
            if ($event !== 'strategic_alignment.restored' && $objective->status === 'archived') {
                throw ValidationException::withMessages(['status' => ['Restore the objective before changing its mappings.']]);
            }
            $mapping = $this->repository->findForUpdate($type, $id, $referenceId);
            abort_unless($mapping, 404);
            $changes = $values($mapping, $objective, $definition);
            DB::table($definition['table'])->where('objective_id', $id)
                ->where($definition['reference_column'], $referenceId)->update([...$changes, 'updated_at' => now()]);
            $this->log->write($event, [
                'actor_user_id' => $actor->user_id, 'resource_type' => 'strategic_alignment',
                'resource_id' => $id, 'objective_id' => $id, 'plan_id' => $planId,
                'reference_type' => $definition['reference_type'], 'reference_id' => $referenceId,
                'from' => $mapping->status, 'to' => $changes['status'] ?? $mapping->status,
                'changes' => $changes,
            ]);
            return ['objective_id' => $id, 'type' => $type, 'reference_id' => $referenceId, ...$changes];
        }, 3);
    }
}
