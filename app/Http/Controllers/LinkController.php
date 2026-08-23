<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLinkRequest;
use App\Http\Requests\UpdateLinkRequest;
use App\Models\Strategic;
use App\Services\LinkService;
use App\Services\PermissionAuthorizationService;
use App\Services\StrategicPlanAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class LinkController extends Controller
{
    public function __construct(
        protected LinkService $linkService,
        private readonly StrategicPlanAuthorizationService $authorizationService,
        private readonly PermissionAuthorizationService $permissionAuthorizationService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'plan_core_values.view',
            $user,
            'You are not authorized to view strategic plan core values.'
        );
        $filters = $request->validate([
            'plan_id' => [
                'nullable',
                'integer',
                Rule::exists('tblstrategic_record', 'record_id')->where(
                    fn ($query) => $query->where('status', '!=', 'deleted')
                ),
            ],
            'core_value_id' => [
                'nullable',
                'integer',
                Rule::exists('tblstrategic_foundations', 'foundation_id')->where(
                    fn ($query) => $query->where('type', 'CORE_VALUE')->where('status', '!=', 'deleted')
                ),
            ],
        ]);
        $authorizedPlanIds = $this->authorizationService->authorizedPlanIdsForListing($user);

        if (! empty($filters['plan_id'])) {
            $plan = Strategic::with('creator')
                ->whereKey($filters['plan_id'])
                ->where('status', '!=', 'deleted')
                ->first();

            if ($plan) {
                $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
                    $plan,
                    $user,
                    'You are not authorized to view strategic plan core values for this strategic plan.'
                );
            }
        }

        return response()->json([
            'data' => $this->linkService->getAll($filters, $authorizedPlanIds),
        ], 200);
    }

    public function show(int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'plan_core_values.view',
            $user,
            'You are not authorized to view strategic plan core values.'
        );
        $link = $this->linkService->getById($id);

        if (! $link) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if (! $link->plan || $link->plan->status === 'deleted') {
            return response()->json(['message' => 'Not found'], 404);
        }

        $link->plan?->loadMissing('creator');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $link->plan,
            $user,
            'You are not authorized to view this strategic plan core value mapping.'
        );

        return response()->json(['data' => $link], 200);
    }

    public function store(StoreLinkRequest $request): JsonResponse
    {
        $plan = Strategic::with('creator')
            ->where('status', '!=', 'deleted')
            ->findOrFail($request->validated('plan_id'));
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $plan,
            Auth::guard('api')->user(),
            'You are not authorized to create strategic plan core value mappings for this strategic plan.'
        );
        $link = $this->linkService->create($request->validated());

        return response()->json(['message' => 'Created', 'data' => $link], 201);
    }

    public function update(UpdateLinkRequest $request, int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $link = $this->linkService->getById($id);

        if (! $link) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        $targetPlanId = $request->validated('plan_id') ?? $link->plan_id;
        $plan = Strategic::with('creator')
            ->where('status', '!=', 'deleted')
            ->findOrFail($targetPlanId);
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $plan,
            $user,
            'You are not authorized to update strategic plan core value mappings for this strategic plan.'
        );
        $updated = $this->linkService->update($id, $request->validated());

        if (! $updated) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        return response()->json(['message' => 'Updated', 'data' => $updated], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'plan_core_values.delete',
            $user,
            'You are not authorized to delete strategic plan core value mappings.'
        );
        $link = $this->linkService->getById($id);

        if (! $link) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if (! $link->plan || $link->plan->status === 'deleted') {
            return response()->json(['message' => 'Not found'], 404);
        }

        $link->plan?->loadMissing('creator');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $link->plan,
            $user,
            'You are not authorized to delete this strategic plan core value mapping.'
        );
        $deleted = $this->linkService->delete($id);

        if (! $deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['message' => 'Deleted'], 200);
    }

    public function byPlan(int $planId): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'plan_core_values.view',
            $user,
            'You are not authorized to view strategic plan core values.'
        );
        $plan = Strategic::with('creator')
            ->whereKey($planId)
            ->where('status', '!=', 'deleted')
            ->first();
        abort_if(! $plan, 404, 'Strategic plan not found.');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $plan,
            $user,
            'You are not authorized to view strategic plan core values for this strategic plan.'
        );

        return response()->json([
            'data' => $this->linkService->getByPlanId($planId),
        ], 200);
    }

    public function syncCoreValues(Request $request, int $planId): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'plan_core_values.update',
            $user,
            'You are not authorized to update strategic plan core values.'
        );
        $plan = Strategic::with('creator')
            ->whereKey($planId)
            ->where('status', '!=', 'deleted')
            ->first();
        abort_if(! $plan, 404, 'Strategic plan not found.');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $plan,
            $user,
            'You are not authorized to update strategic plan core values for this strategic plan.'
        );

        $data = $request->validate([
            'core_value_ids'   => ['array'],
            'core_value_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('tblstrategic_foundations', 'foundation_id')->where(
                    fn ($query) => $query->where('type', 'CORE_VALUE')->where('status', '!=', 'deleted')
                ),
            ],
            'created_by' => ['required', 'integer', Rule::exists('tblusers', 'user_id')],
            'updated_by' => ['required', 'integer', Rule::exists('tblusers', 'user_id')],
        ]);

        $links = $this->linkService->syncCoreValues(
            $planId,
            $data['core_value_ids'] ?? [],
            $data['created_by'],
            $data['updated_by']
        );

        return response()->json(['message' => 'Updated', 'data' => $links], 200);
    }
}
