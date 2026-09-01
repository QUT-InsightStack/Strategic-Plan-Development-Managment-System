<?php

namespace App\Services;

use App\Models\Strategic;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class StrategicPlanAuthorizationService
{
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

        // Future record-level plan access rule.
        // Keep this block disabled until the approved ownership / office /
        // workflow-based visibility rule is confirmed.
        /*
        $matchesApprovedRule = (int) $plan->created_by === (int) $user->user_id
            || $plan->creator?->department === $user->department;

        if (! $matchesApprovedRule) {
            $this->deny($message);
        }
        */

        return $user;
    }

    private function applyApprovedListingScopeHook(Builder $query, User $user): void
    {
        // Future record-level listing scope.
        // Enable this block once the approved "which plans may this user view"
        // rule is finalized.
        /*
        $query->where(function (Builder $builder) use ($user) {
            $builder->where('created_by', $user->user_id)
                ->orWhereHas('creator', fn (Builder $creator) => $creator->where('department', $user->department));
        });
        */
    }

}
