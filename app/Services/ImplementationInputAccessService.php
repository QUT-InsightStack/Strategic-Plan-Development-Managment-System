<?php

namespace App\Services;

use App\Models\ResponsibleUnit;
use App\Models\Strategic;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class ImplementationInputAccessService
{
    private const OFFICE_ROLES = ['Office', 'Responsible Unit User', 'Office Representative', 'Office/Agency', 'Offices / Agencies'];
    private const MANAGEMENT_ROLES = ['Management', 'Executive', 'Management / Executive', 'Division Head'];

    public function __construct(private readonly PermissionAuthorizationService $permissions) {}

    public function ensureCanView(User $actor): void
    {
        abort_unless($actor->status === 'active', 403, 'This action is unauthorized.');
        abort_unless($actor->role?->hasFullAccess()
            || $this->permissions->userPermissionCodes($actor)->intersect([
                'implementation_inputs.view', 'implementation_inputs.view_all', 'implementation_inputs.create',
            ])->isNotEmpty(), 403, 'You are not authorized to view submitted inputs.');
    }

    public function viewsPlanningScope(User $actor): bool
{
    return in_array($actor->role?->role_name, [
        'Administrator',
        'test',
        'Planning Officer',
        'Administrative Admin',
        'Administrative Administrator',
        ...self::MANAGEMENT_ROLES,
    ], true);
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
        $query = Strategic::query()->where('status', '!=', 'deleted');
        if ($actor->role?->hasFullAccess()) {
            return $query;
        }
if (in_array($actor->role?->role_name, [
    'Administrative Admin',
    'Administrative Administrator',
    ...self::MANAGEMENT_ROLES,
], true)) {
    return $query;
}

if ($actor->role?->role_name === 'Planning Officer') {
    return $query->where('created_by', $actor->user_id);
}
        $unit = $this->office($actor);

        return $query->where(fn (Builder $scope) => $scope
            ->whereHas('objectives', fn (Builder $q) => $q->where('status', '!=', 'deleted')
                ->whereHas('responsibleUnitAssignment', fn (Builder $q) => $q->where('responsible_unit_id', $unit->responsible_unit_id)))
            ->orWhereHas('inputs', fn (Builder $q) => $q->whereNull('objective_id')
                ->where('responsible_unit_id', $unit->responsible_unit_id)));
    }

    public function ensurePlan(int $planId, User $actor): Strategic
    {
        $this->ensureCanView($actor);
        $plan = Strategic::query()
        ->where('status', '!=', 'deleted')
        ->findOrFail($planId);
        abort_unless($this->plans($actor)->whereKey($planId)->exists(), 403, 'This plan is outside your authorized input scope.');
        $hasOwnPlanLevelInput = in_array($actor->role?->role_name, self::OFFICE_ROLES, true)
            && $plan->inputs()->whereNull('objective_id')
                ->where('responsible_unit_id', $this->office($actor)->responsible_unit_id)->exists();
        app(StrategicPlanAuthorizationService::class)->ensurePlanIsWithinAuthorizedScope(
            $plan, $actor, 'This plan is outside your authorized input scope.', $hasOwnPlanLevelInput,
        );

        return $plan;
    }

    public function canReview(User $actor): bool
{
    return $actor->status === 'active'
        && in_array($actor->role?->role_name, [
            'Planning Officer',
            'Administrative Admin',
            'Administrative Administrator',
            'test',
        ], true)
        && $this->permissions->userPermissionCodes($actor)
            ->contains('implementation_inputs.review');
}

    private function isManagement(User $actor): bool
    {
        return in_array($actor->role?->role_name, self::MANAGEMENT_ROLES, true);
    }
}
