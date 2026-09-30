<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateObjectiveProgressRequest;
use App\Services\ObjectiveProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ObjectiveProgressController extends Controller
{
    public function __construct(private readonly ObjectiveProgressService $progress) {}

    public function index(Request $request): JsonResponse
    {
        $query = $this->progress->visibleObjectives(auth('api')->user());
        $filters = $request->validate([
            'plan_id' => ['nullable', 'integer', 'min:1'],
            'responsible_unit_id' => ['nullable', 'integer', 'min:1'],
            'progress_status' => ['nullable', Rule::in(['not_started', 'in_progress', 'completed'])],
            'search' => ['nullable', 'string', 'max:255'],
            'per_page' => ['nullable', 'integer', 'between:1,100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        if (! empty($filters['plan_id'])) {
            $query->where('strategic_plan_id', $filters['plan_id']);
        }
        if (! empty($filters['responsible_unit_id'])) {
            $query->whereHas('responsibleUnitAssignment', fn ($q) => $q->where('responsible_unit_id', $filters['responsible_unit_id']));
        }
        if (! empty($filters['progress_status'])) {
            $query->where('progress_status', $filters['progress_status']);
        }
        if (! empty($filters['search'])) {
            $query->where('objective_title', 'like', '%'.$filters['search'].'%');
        }
        $rows = $query->with(['progressUpdater:user_id,first_name,last_name', 'strategicPlan:record_id,title,status'])
            ->orderByDesc('progress_updated_at')->orderByDesc('objective_id')->paginate($filters['per_page'] ?? 20);

        return response()->json(['success' => true, 'data' => $rows->items(), 'meta' => [
            'current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'total' => $rows->total(),
        ]]);
    }

    public function history(Request $request, int $objective): JsonResponse
    {
        $record = $this->progress->visibleObjectives(auth('api')->user())->findOrFail($objective);
        $filters = $request->validate(['per_page' => ['nullable', 'integer', 'between:1,100'], 'page' => ['nullable', 'integer', 'min:1']]);
        $rows = $record->progressUpdates()->orderByDesc('progress_update_id')->paginate($filters['per_page'] ?? 20);

        return response()->json(['success' => true, 'data' => $rows->items(), 'meta' => [
            'current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'total' => $rows->total(),
        ]]);
    }

    public function update(UpdateObjectiveProgressRequest $request, int $objective): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->progress->update($objective, $request->validated(), auth('api')->user())]);
    }
}
