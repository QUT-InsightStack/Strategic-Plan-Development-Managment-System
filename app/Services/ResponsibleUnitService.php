<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\ObjectiveResponsibleUnit;
use App\Models\ResponsibleUnit;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ResponsibleUnitService
{
    public function __construct(
        private readonly PermissionAuthorizationService $permissions,
        private readonly StrategicPlanAuthorizationService $plans,
        private readonly StrategicLogWriter $logWriter,
    ) {}

    private function resolve(array $data): ?ResponsibleUnit
    {
        if (isset($data['responsible_unit_id'])) {
            $unit = ResponsibleUnit::find($data['responsible_unit_id']);
            if (! $unit || ! $unit->is_active) {
                throw ValidationException::withMessages(['responsible_unit_id' => ['Select an active responsible unit.']]);
            }

            return $unit;
        }

        $name = trim($data['responsible_office_agency'] ?? '');
        if ($name === '') {
            return null;
        }

        // Legacy objective forms explicitly allow entering a new office name.
        // Callers must authorize assignment before reaching this method.
        $unit = ResponsibleUnit::firstOrCreate(
            ['name_key' => ResponsibleUnit::nameKey($name)],
            ['responsible_office_agency' => $name, 'is_active' => true],
        );
        if (! $unit->is_active) {
            throw ValidationException::withMessages(['responsible_office_agency' => ['Select an active responsible unit.']]);
        }

        return $unit;
    }

    public function assign(array $objectiveIds, array $data, User $actor): Collection
    {
        $this->permissions->ensureHasPermission('strategic_objectives.assign_responsible_unit', $actor);

        return DB::transaction(function () use ($objectiveIds, $data, $actor) {
            $planIds = StrategicObjective::whereIn('objective_id', $objectiveIds)->pluck('strategic_plan_id');
            // Every collaboration writer locks plans before objectives.
            $plans = Strategic::whereIn('record_id', $planIds)->orderBy('record_id')->lockForUpdate()->get()->keyBy('record_id');
            $objectives = StrategicObjective::whereIn('objective_id', $objectiveIds)
                ->orderBy('objective_id')->lockForUpdate()->get();
            abort_if($objectives->count() !== count($objectiveIds), 404, 'Strategic objective not found.');
            foreach ($objectives as $objective) {
                $plan = $plans->get($objective->strategic_plan_id);
                abort_if(! $plan || $plan->status === 'deleted' || $objective->status === 'deleted', 404);
                $this->plans->ensurePlanIsWithinAuthorizedScope($plan, $actor);
                if ($plan->status === 'archived' || $objective->status === 'archived') {
                    throw ValidationException::withMessages(['objective_ids' => ['Restore archived content before assigning a responsible unit.']]);
                }
            }

            $unit = $this->resolve($data);
            foreach ($objectives as $objective) {
                $this->persist($objective, $unit, $actor);
            }

            return $objectives->load('responsibleUnitAssignment.responsibleUnit');
        }, 3);
    }

    /** Keep existing create/update payloads subject to the same assignment permission. */
    public function applyLegacyAssignment(StrategicObjective $objective, array &$data, User $actor): void
    {
        if (! array_key_exists('responsible_office_agency', $data)) {
            return;
        }
        $name = trim($data['responsible_office_agency'] ?? '');
        if ($objective->exists && $name === trim($objective->responsible_office_agency ?? '')) {
            return;
        }
        if (! $objective->exists && $name === '') {
            return;
        }

        $this->permissions->ensureHasPermission('strategic_objectives.assign_responsible_unit', $actor);
        $unit = $this->resolve($data);
        $data['responsible_office_agency'] = $unit?->responsible_office_agency;
        // The controller saves first, within the same transaction, then syncs the relation.
    }

    public function syncLegacyAssignment(StrategicObjective $objective, User $actor): void
    {
        $name = trim($objective->responsible_office_agency ?? '');
        $unit = $name === '' ? null : ResponsibleUnit::where('name_key', ResponsibleUnit::nameKey($name))->first();
        $this->persist($objective, $unit, $actor, false);
    }

    private function persist(StrategicObjective $objective, ?ResponsibleUnit $unit, User $actor, bool $updateObjective = true): void
    {
        $existing = $objective->responsibleUnitAssignment()->first();
        if ($existing?->responsible_unit_id === $unit?->responsible_unit_id) {
            return;
        }
        if (! $unit && $objective->status === 'published') {
            throw ValidationException::withMessages(['responsible_office_agency' => ['Published objectives require a responsible unit.']]);
        }
        $previousUnitId = $existing?->responsible_unit_id;
        if ($unit) {
            ObjectiveResponsibleUnit::updateOrCreate(['objective_id' => $objective->objective_id], [
                'responsible_unit_id' => $unit->responsible_unit_id,
                'assigned_by' => $actor->user_id,
            ]);
        } else {
            $existing?->delete();
        }
        if ($updateObjective) {
            $objective->fill(['responsible_office_agency' => $unit?->responsible_office_agency, 'updated_by' => $actor->user_id])->save();
        }
        $this->logWriter->write('strategic_objective.responsible_unit_assigned', [
            'resource_type' => 'strategic_objective', 'resource_id' => $objective->objective_id,
            'actor_user_id' => $actor->user_id, 'previous_responsible_unit_id' => $previousUnitId,
            'responsible_unit_id' => $unit?->responsible_unit_id,
        ]);
    }
}
