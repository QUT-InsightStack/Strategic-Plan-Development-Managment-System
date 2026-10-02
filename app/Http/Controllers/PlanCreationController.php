<?php

namespace App\Http\Controllers;

use App\Http\Requests\CopyPlanRequest;
use App\Http\Requests\CreatePlanRequest;
use App\Http\Requests\DeletePlanRequest;
use App\Http\Requests\UpdatePlanRequest;
use App\Http\Requests\UpdatePlanStatusRequest;
use App\Models\Strategic;
use App\Services\PlanCreationService;
use App\Services\StrategicPlanAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class PlanCreationController extends Controller
{
    public function __construct(
        private readonly PlanCreationService $planCreationService,
        private readonly StrategicPlanAuthorizationService $authorizationService
    ) {
    }

    public function store(CreatePlanRequest $request): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->authorizationService->ensureCanCreatePlan($user);
        $data = $request->validated();
        $plan = $this->planCreationService->create($data, $user);

        return response()->json([
            'success' => true,
            'message' => 'Strategic plan created.',
            'record_id' => $plan->record_id,
            'data' => $plan,
            'pending_database_fields' => [
                'department_agency' => $data['department_agency'] ?? null,
            ],
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->authorizationService->ensureCanViewAny($user);
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'level' => ['nullable', 'string', Rule::in(['strategic_plan', 'goal'])],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'status' => ['nullable', 'string', Rule::in(['draft', 'finished', 'archived', 'deleted'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'include_all_office_plans' => ['sometimes', 'boolean'],
        ]);
        $includeAllOfficePlans = (bool) ($filters['include_all_office_plans'] ?? false);
        $authorizedPlanIds = $this->authorizationService->authorizedPlanIdsForListing($user, ['archived', 'deleted'], $includeAllOfficePlans);
        $plans = $this->planCreationService->paginate($filters, $authorizedPlanIds);

        return response()->json([
            'success' => true,
            'message' => 'Strategic plans loaded.',
            'data' => $plans->items(),
            'meta' => [
                'current_page' => $plans->currentPage(),
                'last_page' => $plans->lastPage(),
                'per_page' => $plans->perPage(),
                'total' => $plans->total(),
            ],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->authorizationService->ensureCanViewAny($user);
        $plan = $this->planCreationService->find($id);
        abort_if(! $plan, 404, 'Strategic plan not found.');
        $includeAllOfficePlans = $request->boolean('include_all_office_plans');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope($plan, $user, 'You are not authorized to view this strategic plan.', $includeAllOfficePlans);

        return response()->json(['success' => true, 'data' => $plan]);
    }

    public function update(UpdatePlanRequest $request, int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $plan = Strategic::with(['creator', 'missionFoundation', 'visionFoundation', 'coreValues'])
            ->where('status', '!=', 'deleted')
            ->find($id);
        abort_if(! $plan, 404, 'Strategic plan not found.');
        $this->authorizationService->ensureCanUpdatePlan($plan, $user);

        $updated = $this->planCreationService->update($plan, $request->validated(), $user);

        return response()->json([
            'success' => true,
            'message' => 'Strategic plan updated.',
            'data' => $updated,
            'pending_database_fields' => $request->safe()->only(['department_agency']),
        ]);
    }

    public function destroy(DeletePlanRequest $request, int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $plan = $this->planCreationService->find($id);
        abort_if(! $plan, 404, 'Strategic plan not found.');
        $this->authorizationService->ensureCanDeletePlan($plan, $user);
        $this->planCreationService->delete($plan);

        return response()->json(['success' => true, 'message' => 'Strategic plan deleted.']);
    }

    public function copy(CopyPlanRequest $request, int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $source = $this->planCreationService->find($id);
        abort_if(! $source, 404, 'Strategic plan not found.');
        $this->authorizationService->ensureCanViewPlan($source, $user);
        $this->authorizationService->ensureCanCreatePlan($user);

        $copy = $this->planCreationService->copy($source, $user);

        return response()->json([
            'success' => true,
            'message' => 'Strategic plan copied successfully.',
            'record_id' => $copy->record_id,
            'data' => $copy,
        ], 201);
    }

    public function updateStatus(UpdatePlanStatusRequest $request, int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $plan = Strategic::with('creator')->where('status', '!=', 'deleted')->find($id);
        abort_if(! $plan, 404, 'Strategic plan not found.');
        $this->authorizationService->ensureCanArchivePlan($plan, $user);

        $updated = $this->planCreationService->updateStatus(
            $plan,
            $request->validated('status'),
            $user
        );

        return response()->json([
            'success' => true,
            'message' => $updated->status === 'archived'
                ? 'Strategic plan archived successfully.'
                : 'Strategic plan restored to finished successfully.',
            'data' => $updated,
        ]);
    }
}
