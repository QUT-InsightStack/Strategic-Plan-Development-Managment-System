<?php

namespace App\Http\Controllers;

use App\Http\Requests\CopyPlanRequest;
use App\Http\Requests\CreatePlanRequest;
use App\Http\Requests\DeletePlanRequest;
use App\Http\Requests\UpdatePlanRequest;
use App\Http\Requests\UpdatePlanStatusRequest;
use App\Models\Strategic;
use App\Services\PlanCreationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class PlanCreationController extends Controller
{
    public function __construct(private readonly PlanCreationService $planCreationService)
    {
    }

    public function store(CreatePlanRequest $request): JsonResponse
    {
        $data = $request->validated();
        $plan = $this->planCreationService->create($data, Auth::guard('api')->user());

        return response()->json([
            'success' => true,
            'message' => 'Strategic plan created.',
            'record_id' => $plan->record_id,
            'data' => $plan,
            'pending_database_fields' => [
                'planning_start_date' => $data['planning_start_date'] ?? null,
                'planning_end_date' => $data['planning_end_date'] ?? null,
                'department_agency' => $data['department_agency'] ?? null,
            ],
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'level' => ['nullable', 'string', Rule::in(['strategic_plan', 'goal'])],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'status' => ['nullable', 'string', Rule::in(['draft', 'finished', 'archived', 'deleted'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $plans = $this->planCreationService->paginate($filters);

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

    public function show(int $id): JsonResponse
    {
        $plan = $this->planCreationService->find($id);
        abort_if(! $plan, 404, 'Strategic plan not found.');

        return response()->json(['success' => true, 'data' => $plan]);
    }

    public function update(UpdatePlanRequest $request, int $id): JsonResponse
    {
        $plan = Strategic::with(['missionFoundation', 'visionFoundation', 'coreValues'])
            ->where('status', '!=', 'deleted')
            ->find($id);
        abort_if(! $plan, 404, 'Strategic plan not found.');

        $updated = $this->planCreationService->update($plan, $request->validated(), Auth::guard('api')->user());

        return response()->json([
            'success' => true,
            'message' => 'Strategic plan updated.',
            'data' => $updated,
            'pending_database_fields' => $request->safe()->only(['planning_start_date', 'planning_end_date', 'department_agency']),
        ]);
    }

    public function destroy(DeletePlanRequest $request, int $id): JsonResponse
    {
        $plan = $this->planCreationService->find($id);
        abort_if(! $plan, 404, 'Strategic plan not found.');
        $this->planCreationService->delete($plan);

        return response()->json(['success' => true, 'message' => 'Strategic plan deleted.']);
    }

    public function copy(CopyPlanRequest $request, int $id): JsonResponse
    {
        $source = $this->planCreationService->find($id);
        abort_if(! $source, 404, 'Strategic plan not found.');

        $copy = $this->planCreationService->copy($source, Auth::guard('api')->user());

        return response()->json([
            'success' => true,
            'message' => 'Strategic plan copied successfully.',
            'record_id' => $copy->record_id,
            'data' => $copy,
        ], 201);
    }

    public function updateStatus(UpdatePlanStatusRequest $request, int $id): JsonResponse
    {
        $plan = Strategic::where('status', '!=', 'deleted')->find($id);
        abort_if(! $plan, 404, 'Strategic plan not found.');

        $updated = $this->planCreationService->updateStatus(
            $plan,
            $request->validated('status'),
            Auth::guard('api')->user()
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
