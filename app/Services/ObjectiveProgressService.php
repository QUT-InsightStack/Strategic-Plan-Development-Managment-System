<?php

namespace App\Services;

use App\Models\ObjectiveProgressUpdate;
use App\Models\ResponsibleUnit;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class ObjectiveProgressService
{
    private const PLANNING_ROLES = ['Administrator', 'Planning Officer', 'Planner/Encoder'];

    private const OFFICE_ROLES = ['Responsible Unit User', 'Office Representative', 'Office/Agency', 'Offices / Agencies'];

    public function __construct(
        private readonly PermissionAuthorizationService $permissions,
        private readonly StrategicPlanAuthorizationService $plans,
    ) {}

    private function isPlanner(User $actor): bool
    {
        return in_array($actor->role?->role_name, self::PLANNING_ROLES, true);
    }

    private function office(User $actor, bool $lock = false): ResponsibleUnit
    {
        abort_unless(in_array($actor->role?->role_name, self::OFFICE_ROLES, true), 403, 'Office/Unit membership is required.');
        $unit = ResponsibleUnit::where('name_key', ResponsibleUnit::nameKey($actor->office ?? ''))
            ->where('is_active', true)->when($lock, fn ($q) => $q->lockForUpdate())->first();
        abort_unless($unit, 403, 'Your account has no active Office/Unit membership.');

        return $unit;
    }

    public function visibleObjectives(User $actor): Builder
    {
        abort_unless($actor->status === 'active', 403);
        $this->permissions->ensureHasPermission('strategic_objectives.view_progress', $actor);
        $query = StrategicObjective::where('status', '!=', 'deleted')
            ->whereIn('strategic_plan_id', $this->plans->authorizedPlanIdsForListing($actor, ['deleted']))
            ->whereHas('strategicPlan', fn ($q) => $q->where('level', 'strategic_plan')->where('status', '!=', 'deleted'));
        if (! $this->isPlanner($actor)) {
            $unit = $this->office($actor);
            $query->whereHas('responsibleUnitAssignment', fn ($q) => $q->where('responsible_unit_id', $unit->responsible_unit_id));
        }

        return $query;
    }

    public function update(int $objectiveId, array $data, User $actor): StrategicObjective
    {
        return DB::transaction(function () use ($objectiveId, $data, $actor) {
            // Use the same plan -> objective -> user -> unit lock order as assignment writers.
            $planId = StrategicObjective::whereKey($objectiveId)->value('strategic_plan_id');
            $plan = Strategic::where('level', 'strategic_plan')->where('status', '!=', 'deleted')->lockForUpdate()->findOrFail($planId);
            $objective = StrategicObjective::where('strategic_plan_id', $plan->record_id)
                ->where('status', '!=', 'deleted')->lockForUpdate()->findOrFail($objectiveId);
            $actor = User::lockForUpdate()->findOrFail($actor->user_id);
            abort_unless($actor->status === 'active', 403);
            $this->plans->ensurePlanIsWithinAuthorizedScope($plan, $actor);
            $correction = $this->isPlanner($actor);
            $this->permissions->ensureHasPermission('strategic_objectives.'.($correction ? 'correct_progress' : 'update_progress'), $actor);
            if (! $correction) {
                $unit = $this->office($actor, true);
                abort_unless($objective->responsibleUnitAssignment()->where('responsible_unit_id', $unit->responsible_unit_id)->exists(),
                    403, 'Your Office/Unit is not assigned to this strategic objective.');
            }
            if (! in_array($plan->status, ['draft', 'finished'], true) || ! in_array($objective->status, ['draft', 'published'], true)) {
                throw ValidationException::withMessages(['progress_percentage' => ['Restore archived content before updating progress.']]);
            }
            $data['reason'] = is_string($data['reason'] ?? null) ? trim($data['reason']) : ($data['reason'] ?? null);
            $validated = Validator::make($data, [
                'progress_percentage' => ['required', 'integer:strict', 'between:0,100'],
                'reason' => [$correction ? 'required' : 'nullable', 'string', 'max:5000'],
            ])->validate();
            $previous = $objective->progress_percentage;
            $previousStatus = $objective->progress_status;
            $objective->progress_percentage = (int) $validated['progress_percentage'];
            $objective->progress_updated_at = now();
            $objective->progress_updated_by = $actor->user_id;
            $objective->save();
            $objective->refresh(); // Read the database-generated status.
            ObjectiveProgressUpdate::create([
                'objective_id' => $objective->objective_id, 'updated_by' => $actor->user_id,
                'updater_name' => $actor->name, 'updater_role' => $actor->role->role_name,
                'is_correction' => $correction, 'previous_percentage' => $previous,
                'previous_status' => $previousStatus, 'new_percentage' => $objective->progress_percentage,
                'new_status' => $objective->progress_status, 'reason' => $validated['reason'] ?? null,
                'created_at' => $objective->progress_updated_at,
            ]);

            return $objective->load('progressUpdater:user_id,first_name,last_name');
        }, 3);
    }
}
