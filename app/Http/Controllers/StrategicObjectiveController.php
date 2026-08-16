<?php

namespace App\Http\Controllers;

use App\Contracts\StrategicLogWriter;
use App\Http\Requests\StoreStrategicObjectiveRequest;
use App\Http\Requests\UpdateStrategicObjectiveRequest;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Services\PermissionAuthorizationService;
use App\Services\StrategicPlanAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StrategicObjectiveController extends Controller
{
    public function __construct(
        private readonly StrategicLogWriter $logWriter,
        private readonly StrategicPlanAuthorizationService $authorizationService,
        private readonly PermissionAuthorizationService $permissionAuthorizationService
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'strategic_objectives.view',
            $user,
            'You are not authorized to view strategic objectives.'
        );
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'plan_id' => [
                'nullable',
                'integer',
                Rule::exists('tblstrategic_record', 'record_id')->where(
                    fn ($query) => $query->where('status', '!=', 'deleted')
                ),
            ],
            'status' => ['nullable', 'string', Rule::in(['draft', 'published', 'archived', 'deleted'])],
            'responsible_office_agency' => ['nullable', 'string', 'max:255'],
            'year' => ['nullable', 'integer', 'min:2000', 'max:2100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
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
                    'You are not authorized to view strategic objectives for this strategic plan.'
                );
            }
        }

        $query = StrategicObjective::with(['strategicPlan', 'creator', 'updater'])
            ->where('status', '!=', 'deleted')
            ->whereIn('strategic_plan_id', $authorizedPlanIds->all())
            ->whereHas('strategicPlan', fn ($builder) => $builder->whereIn('status', ['draft', 'finished']));

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($builder) use ($search) {
                $builder->where('objective_title', 'like', "%{$search}%")
                    ->orWhere('expected_outcome', 'like', "%{$search}%")
                    ->orWhere('indicator', 'like', "%{$search}%");
            });
        }
        if (! empty($filters['plan_id'])) {
            $query->where('strategic_plan_id', $filters['plan_id']);
        }
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['responsible_office_agency'])) {
            $query->where('responsible_office_agency', 'like', '%' . $filters['responsible_office_agency'] . '%');
        }
        if (! empty($filters['year'])) {
            $query->whereYear('updated_at', $filters['year']);
        }

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
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'strategic_objectives.view',
            $user,
            'You are not authorized to view strategic objectives.'
        );
        $plan = Strategic::with('creator')
            ->whereKey($planId)
            ->where('status', '!=', 'deleted')
            ->first();
        abort_if(! $plan, 404, 'Strategic plan not found.');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $plan,
            $user,
            'You are not authorized to view strategic objectives for this strategic plan.'
        );

        $objectives = StrategicObjective::where('strategic_plan_id', $planId)
            ->where('status', '!=', 'deleted')
            ->orderBy('objective_id')
            ->get();

        return response()->json(['data' => $objectives], 200);
    }

    public function show(int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'strategic_objectives.view',
            $user,
            'You are not authorized to view strategic objectives.'
        );
        $objective = StrategicObjective::with(['strategicPlan', 'creator', 'updater'])
            ->where('status', '!=', 'deleted')
            ->find($id);

        if (! $objective || $objective->strategicPlan?->status === 'deleted') {
            return response()->json(['message' => 'Not found'], 404);
        }

        $objective->strategicPlan?->loadMissing('creator');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $objective->strategicPlan,
            $user,
            'You are not authorized to view this strategic objective.'
        );

        return response()->json(['data' => $objective], 200);
    }

    public function store(StoreStrategicObjectiveRequest $request): JsonResponse
    {
        $data = $request->validated();
        $plan = Strategic::with('creator')
            ->where('status', '!=', 'deleted')
            ->findOrFail($data['strategic_plan_id']);
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $plan,
            Auth::guard('api')->user(),
            'You are not authorized to create objectives for this strategic plan.'
        );
        $this->ensurePlanCanBeChanged($plan);

        $data['created_by'] = Auth::guard('api')->id();
        $data['status'] = $data['status'] ?? 'draft';
        $data['status_before_archive'] = null;
        $data['archived_at'] = null;
        $data['archived_by'] = null;
        $data['deleted_at'] = null;

        $objective = StrategicObjective::create($data);

        $this->logWriter->write('strategic_objective.created', [
            'objective_id' => $objective->objective_id,
            'record_id' => $objective->strategic_plan_id,
        ]);

        return response()->json([
            'message' => 'Created',
            'data' => $objective,
        ], 201);
    }

    public function update(UpdateStrategicObjectiveRequest $request, int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $objective = StrategicObjective::where('status', '!=', 'deleted')->find($id);

        if (! $objective) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if (! $objective->strategicPlan || $objective->strategicPlan->status === 'deleted') {
            return response()->json(['message' => 'Not found'], 404);
        }

        $objective->strategicPlan?->loadMissing('creator');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $objective->strategicPlan,
            $user,
            'You are not authorized to update this strategic objective.'
        );
        $this->ensurePlanCanBeChanged($objective->strategicPlan);
        $data = $request->validated();
        $data['updated_by'] = Auth::guard('api')->id();
        $objective->update($data);

        $this->logWriter->write('strategic_objective.updated', [
            'objective_id' => $objective->objective_id,
            'record_id' => $objective->strategic_plan_id,
        ]);

        return response()->json([
            'message' => 'Updated',
            'data' => $objective->fresh(),
        ], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'strategic_objectives.delete',
            $user,
            'You are not authorized to delete strategic objectives.'
        );
        $objective = StrategicObjective::where('status', '!=', 'deleted')->find($id);

        if (! $objective) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if (! $objective->strategicPlan || $objective->strategicPlan->status === 'deleted') {
            return response()->json(['message' => 'Not found'], 404);
        }

        $objective->strategicPlan?->loadMissing('creator');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $objective->strategicPlan,
            $user,
            'You are not authorized to delete this strategic objective.'
        );
        $this->ensurePlanCanBeChanged($objective->strategicPlan);
        $objective->update([
            'updated_by' => Auth::guard('api')->id(),
            'status' => 'deleted',
            'status_before_archive' => null,
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => now(),
        ]);

        $this->logWriter->write('strategic_objective.deleted', [
            'objective_id' => $objective->objective_id,
            'record_id' => $objective->strategic_plan_id,
        ]);

        return response()->json(['message' => 'Deleted'], 200);
    }

    private function ensurePlanCanBeChanged(Strategic $plan): void
    {
        if ($plan->status === 'archived') {
            throw ValidationException::withMessages([
                'strategic_plan_id' => ['Archived strategic plans must be restored before their objectives can be changed.'],
            ]);
        }

        if ($plan->status === 'deleted') {
            throw ValidationException::withMessages([
                'strategic_plan_id' => ['Deleted strategic plans cannot be changed.'],
            ]);
        }
    }
}
