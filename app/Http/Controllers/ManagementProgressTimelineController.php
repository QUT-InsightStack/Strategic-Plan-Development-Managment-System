<?php

namespace App\Http\Controllers;

use App\Models\ObjectiveProgressUpdate;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Services\PermissionAuthorizationService;
use App\Services\StrategicPlanAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Read-only progress timeline for one plan, used by the Management dashboard's six-year chart.
 * It applies the same plan and objective scope as GET /api/strategic-objectives.
 */
class ManagementProgressTimelineController extends Controller
{
    public function __construct(
        private readonly StrategicPlanAuthorizationService $authorizationService,
        private readonly PermissionAuthorizationService $permissionAuthorizationService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'strategic_objectives.view',
            $user,
            'You are not authorized to view strategic objectives.'
        );
        $filters = $request->validate(['plan_id' => ['required', 'integer', 'min:1']]);

        $plan = Strategic::whereKey($filters['plan_id'])->where('status', '!=', 'deleted')->firstOrFail();
        abort_unless($this->authorizationService->authorizedPlanIdsForListing($user, ['deleted'])->contains($plan->record_id), 403,
            'You are not authorized to view strategic objectives for this strategic plan.');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope($plan, $user,
            'You are not authorized to view strategic objectives for this strategic plan.');

        $query = StrategicObjective::where('strategic_plan_id', $plan->record_id)->where('status', '!=', 'deleted');
        $this->authorizationService->scopeObjectivesForUser($query, $user);
        $objectives = $query->orderBy('objective_id')
            ->get(['objective_id', 'status', 'created_at', 'progress_percentage', 'progress_status', 'progress_updated_at']);

        $updates = ObjectiveProgressUpdate::whereIn('objective_id', $objectives->pluck('objective_id'))
            ->orderBy('created_at')->orderBy('progress_update_id')
            ->get(['objective_id', 'new_percentage', 'new_status', 'created_at']);

        return response()->json(['success' => true, 'data' => [
            'plan_id' => $plan->record_id,
            'planning_start_date' => $plan->planning_start_date,
            'planning_end_date' => $plan->planning_end_date,
            'objectives' => $objectives,
            'updates' => $updates,
        ]]);
    }
}
