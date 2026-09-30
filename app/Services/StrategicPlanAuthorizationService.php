<?php

namespace App\Services;

use App\Models\Strategic;
use App\Models\ResponsibleUnit;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class StrategicPlanAuthorizationService
{
    private const OFFICE_ROLES = ['Office', 'Responsible Unit User', 'Office Representative', 'Office/Agency', 'Offices / Agencies'];

    public function __construct(private readonly PermissionAuthorizationService $permissionAuthorizationService)
    {
    }

    public function ensureCanViewAny(?User $user = null): User
    {
        return $this->permissionAuthorizationService->ensureHasPermission(
            'strategic_records.view',
            $user,
            'You are not authorized to view strategic plans.'
        );
    }

    public function ensureCanViewPlan(Strategic $plan, ?User $user = null): User
    {
        $user = $this->ensureCanViewAny($user);

        $this->ensurePlanIsWithinAuthorizedScope(
            $plan,
            $user,
            'You are not authorized to view this strategic plan.'
        );

        return $user;
    }

    public function ensureCanCreatePlan(?User $user = null): User
    {
        return $this->permissionAuthorizationService->ensureHasPermission(
            'strategic_records.create',
            $user,
            'You are not authorized to create strategic plans.'
        );
    }

    public function ensureCanUpdatePlan(Strategic $plan, ?User $user = null): User
    {
        $user = $this->permissionAuthorizationService->ensureHasPermission(
            'strategic_records.update',
            $user,
            'You are not authorized to update this strategic plan.'
        );

        $this->ensurePlanIsWithinAuthorizedScope(
            $plan,
            $user,
            'You are not authorized to update this strategic plan.'
        );

        return $user;
    }

    public function ensureCanDeletePlan(Strategic $plan, ?User $user = null): User
    {
        $user = $this->permissionAuthorizationService->ensureHasPermission(
            'strategic_records.delete',
            $user,
            'You are not authorized to delete this strategic plan.'
        );

        $this->ensurePlanIsWithinAuthorizedScope(
            $plan,
            $user,
            'You are not authorized to delete this strategic plan.'
        );

        return $user;
    }

    public function ensureCanArchivePlan(Strategic $plan, ?User $user = null): User
    {
        $user = $this->permissionAuthorizationService->ensureHasPermission(
            'strategic_records.archive',
            $user,
            'You are not authorized to change this strategic plan status.'
        );

        $this->ensurePlanIsWithinAuthorizedScope(
            $plan,
            $user,
            'You are not authorized to change this strategic plan status.'
        );

        return $user;
    }

    public function authorizedPlanIdsForListing(?User $user = null, array $excludedStatuses = ['archived', 'deleted']): Collection
    {
        $user = $this->permissionAuthorizationService->resolveUser($user);

        $query = Strategic::query()
            ->select('record_id')
            ->whereNotIn('status', $excludedStatuses);

        $this->applyApprovedListingScopeHook($query, $user);

        return $query->pluck('record_id');
    }

    public function ensurePlanIsWithinAuthorizedScope(Strategic $plan, ?User $user = null, string $message = 'You are not authorized to view this strategic plan.'): User
    {
        $user = $this->permissionAuthorizationService->resolveUser($user);

        if (in_array($user->role?->role_name, self::OFFICE_ROLES, true)) {
            $unit = $this->activeOfficeUnit($user);
            abort_unless($unit && $plan->objectives()
                ->whereHas('responsibleUnitAssignment', fn (Builder $query) => $query->where('responsible_unit_id', $unit->responsible_unit_id))
                ->exists(), 403, $message);
        }

        return $user;
    }

    private function applyApprovedListingScopeHook(Builder $query, User $user): void
    {
        if (! in_array($user->role?->role_name, self::OFFICE_ROLES, true)) {
            return;
        }

        $unit = $this->activeOfficeUnit($user);
        if (! $unit) {
            $query->whereRaw('1 = 0');
            return;
        }

        $query->whereHas('objectives.responsibleUnitAssignment', fn (Builder $assignment) =>
            $assignment->where('responsible_unit_id', $unit->responsible_unit_id));
    }

    private function activeOfficeUnit(User $user): ?ResponsibleUnit
    {
        $office = trim((string) $user->office);
        if ($office === '') {
            return null;
        }

        return ResponsibleUnit::query()
            ->where('name_key', ResponsibleUnit::nameKey($office))
            ->where('is_active', true)
            ->first();
    }

}
