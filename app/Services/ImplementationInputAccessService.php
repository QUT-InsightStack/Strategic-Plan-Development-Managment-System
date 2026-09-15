<?php

namespace App\Services;

use App\Models\ResponsibleUnit;
use App\Models\Strategic;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class ImplementationInputAccessService
{
    private const OFFICE_ROLES = ['Responsible Unit User', 'Office Representative', 'Office/Agency', 'Offices / Agencies'];

    public function __construct(private readonly PermissionAuthorizationService $permissions) {}

    public function ensureCanView(User $actor): void
    {
        abort_unless($actor->status === 'active', 403, 'This action is unauthorized.');
        abort_unless($actor->role?->role_name === 'Administrator'
            || $this->permissions->userPermissionCodes($actor)->intersect([
                'implementation_inputs.view', 'implementation_inputs.view_all', 'implementation_inputs.create',
            ])->isNotEmpty(), 403, 'You are not authorized to view submitted inputs.');
    }

    public function viewsPlanningScope(User $actor): bool
    {
        return ! in_array($actor->role?->role_name, self::OFFICE_ROLES, true)
            && (in_array($actor->role?->role_name, ['Administrator', 'Planning Officer'], true)
                || $this->permissions->userPermissionCodes($actor)->contains('implementation_inputs.view_all'));
    }

    public function office(User $actor): ResponsibleUnit
    {
        $unit = ResponsibleUnit::where('name_key', ResponsibleUnit::nameKey($actor->office ?? ''))
            ->where('is_active', true)->first();
        abort_unless($unit, 403, 'Your account has no active Office/Agency membership.');

        return $unit;
    }

    public function plans(User $actor): Builder
    {
        $this->ensureCanView($actor);
        $query = Strategic::where('level', 'strategic_plan')->where('status', '!=', 'deleted');
        if ($actor->role?->role_name === 'Administrator') {
            return $query;
        }
        if ($this->viewsPlanningScope($actor)) {
            return $query->whereIn('record_id', DB::table('tblimplementation_input_scopes')
                ->select('strategic_plan_id')->where('user_id', $actor->user_id));
        }
        $unit = $this->office($actor);

        return $query->whereHas('objectives', fn (Builder $q) => $q->where('status', '!=', 'deleted')
            ->whereHas('responsibleUnitAssignment', fn (Builder $q) => $q->where('responsible_unit_id', $unit->responsible_unit_id)));
    }

    public function ensurePlan(int $planId, User $actor): Strategic
    {
        $this->ensureCanView($actor);
        $plan = Strategic::where('level', 'strategic_plan')->where('status', '!=', 'deleted')->findOrFail($planId);
        abort_unless($this->plans($actor)->whereKey($planId)->exists(), 403, 'This plan is outside your authorized input scope.');
        app(StrategicPlanAuthorizationService::class)->ensurePlanIsWithinAuthorizedScope($plan, $actor);

        return $plan;
    }

    public function canReview(User $actor): bool
    {
        return $actor->status === 'active' && $actor->role?->role_name === 'Planning Officer'
            && $this->permissions->userPermissionCodes($actor)->contains('implementation_inputs.review')
            && $this->viewsPlanningScope($actor);
    }
}
