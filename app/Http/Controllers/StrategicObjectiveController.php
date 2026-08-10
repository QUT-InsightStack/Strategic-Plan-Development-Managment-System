<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStrategicObjectiveRequest;
use App\Http\Requests\UpdateStrategicObjectiveRequest;
use App\Models\StrategicObjective;
use App\Models\Strategic;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StrategicObjectiveController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'plan_id' => ['nullable', 'integer', Rule::exists('tblstrategic_record', 'record_id')],
            'status' => ['nullable', 'string', Rule::in(['draft', 'published'])],
            'responsible_office_agency' => ['nullable', 'string', 'max:255'],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        // Authentication is currently the only access boundary. A policy/scope
        // can be applied to this query later without changing the API contract.
        $query = StrategicObjective::with(['strategicPlan', 'creator', 'updater']);
        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($builder) use ($search) {
                $builder->where('objective_title', 'like', "%{$search}%")
                    ->orWhere('expected_outcome', 'like', "%{$search}%")
                    ->orWhere('indicator', 'like', "%{$search}%");
            });
        }
        if (!empty($filters['plan_id'])) $query->where('strategic_plan_id', $filters['plan_id']);
        if (!empty($filters['status'])) $query->where('status', $filters['status']);
        if (!empty($filters['responsible_office_agency'])) $query->where('responsible_office_agency', 'like', '%' . $filters['responsible_office_agency'] . '%');
        if (!empty($filters['year'])) $query->whereYear('updated_at', $filters['year']);

        $objectives = $query->orderByDesc('updated_at')->paginate($filters['per_page'] ?? 10);

        return response()->json([
            'success' => true,
            'data' => $objectives->items(),
            'meta' => [
                'current_page' => $objectives->currentPage(),
                'last_page' => $objectives->lastPage(),
                'per_page' => $objectives->perPage(),
                'total' => $objectives->total(),
            ],
        ], 200);
    }

    public function byPlan(int $planId): JsonResponse
    {
        abort_unless(Strategic::whereKey($planId)->exists(), 404, 'Strategic plan not found.');

        $objectives = StrategicObjective::where('strategic_plan_id', $planId)
            ->orderBy('objective_id')
            ->get();

        return response()->json(['data' => $objectives], 200);
    }

    public function show(int $id): JsonResponse
    {
        $objective = StrategicObjective::with(['strategicPlan', 'creator', 'updater'])
            ->find($id);

        if (! $objective) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['data' => $objective], 200);
    }

    public function store(StoreStrategicObjectiveRequest $request): JsonResponse
    {
        $data = $request->validated();
        $plan = Strategic::findOrFail($data['strategic_plan_id']);
        $this->ensurePlanCanBeChanged($plan);
        $data['created_by'] = Auth::guard('api')->id();
        $data['status'] = $data['status'] ?? 'draft';
        $objective = StrategicObjective::create($data);

        return response()->json([
            'message' => 'Created',
            'data' => $objective,
        ], 201);
    }

    public function update(UpdateStrategicObjectiveRequest $request, int $id): JsonResponse
    {
        $objective = StrategicObjective::find($id);

        if (! $objective) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $this->ensurePlanCanBeChanged($objective->strategicPlan);
        $data = $request->validated();
        $data['updated_by'] = Auth::guard('api')->id();
        $objective->update($data);

        return response()->json([
            'message' => 'Updated',
            'data' => $objective->fresh(),
        ], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $objective = StrategicObjective::find($id);

        if (! $objective) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $this->ensurePlanCanBeChanged($objective->strategicPlan);
        $objective->delete();

        return response()->json(['message' => 'Deleted'], 200);
    }

    private function ensurePlanCanBeChanged(Strategic $plan): void
    {
        if ($plan->status === 'archived') {
            throw ValidationException::withMessages([
                'strategic_plan_id' => ['Archived strategic plans must be restored before their objectives can be changed.'],
            ]);
        }
    }
}
