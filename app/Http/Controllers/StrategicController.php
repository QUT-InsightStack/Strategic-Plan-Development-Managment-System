<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStrategicRequest;
use App\Http\Requests\UpdateStrategicRequest;
use App\Services\StrategicPlanAuthorizationService;
use App\Services\StrategicService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class StrategicController extends Controller
{
    public function __construct(
        protected StrategicService $strategicService,
        private readonly StrategicPlanAuthorizationService $authorizationService
    ) {
    }

    public function index(): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->authorizationService->ensureCanViewAny($user);
        $authorizedRecordIds = $this->authorizationService->authorizedPlanIdsForListing($user);

        return response()->json(['data' => $this->strategicService->getAll($authorizedRecordIds)], 200);
    }

    public function show(int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $strategic = $this->strategicService->getById($id);

        if (!$strategic) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $this->authorizationService->ensureCanViewPlan($strategic, $user);

        return response()->json(['data' => $strategic], 200);
    }

    public function store(StoreStrategicRequest $request): JsonResponse
    {
        $this->authorizationService->ensureCanCreatePlan(Auth::guard('api')->user());
        $strategic = $this->strategicService->create($request->validated());

        return response()->json(['message' => 'Created', 'data' => $strategic], 201);
    }

    public function update(UpdateStrategicRequest $request, int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $strategic = $this->strategicService->getById($id);

        if (! $strategic) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        $this->authorizationService->ensureCanUpdatePlan($strategic, $user);
        $updated = $this->strategicService->update($id, $request->validated());

        if (!$updated) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        return response()->json(['message' => 'Updated'], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $strategic = $this->strategicService->getById($id);

        if (! $strategic) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $this->authorizationService->ensureCanDeletePlan($strategic, $user);
        $deleted = $this->strategicService->delete($id);

        if (!$deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['message' => 'Deleted'], 200);
    }
}
