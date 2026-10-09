<?php

namespace App\Http\Controllers;

use App\Contracts\StrategicLogWriter;
use App\Models\ResponsibleUnit;
use App\Models\Strategic;
use App\Models\StrategicPlanComment;
use App\Services\PermissionAuthorizationService;
use App\Services\StrategicPlanAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StrategicPlanCommentController extends Controller
{
    public function __construct(
        private readonly PermissionAuthorizationService $permissions,
        private readonly StrategicPlanAuthorizationService $plans,
        private readonly StrategicLogWriter $logWriter,
    ) {}

    public function index(Request $request, int $planId): JsonResponse
    {
        $actor = $this->permissions->ensureHasPermission('objective_comments.create', $request->user('api'));
        $this->plan($planId, $actor);
        $comments = StrategicPlanComment::where('strategic_plan_id', $planId)
            ->orderBy('plan_comment_id')->paginate(25);

        return response()->json(['success' => true, 'data' => $comments->items(), 'meta' => [
            'current_page' => $comments->currentPage(), 'last_page' => $comments->lastPage(),
            'per_page' => $comments->perPage(), 'total' => $comments->total(),
        ]]);
    }

    public function store(Request $request, int $planId): JsonResponse
    {
        $actor = $this->permissions->ensureHasPermission('objective_comments.create', $request->user('api'));
        $plan = $this->plan($planId, $actor);
        $data = $request->validate(['content' => ['required', 'string', 'max:10000', 'regex:/\S/u']]);
        $management = in_array($actor->role?->role_name, ['Management', 'Executive', 'Management / Executive', 'Division Head'], true);
        $unit = $management ? null : ResponsibleUnit::where('name_key', ResponsibleUnit::nameKey($actor->office ?? ''))
            ->where('is_active', true)->firstOrFail();

        $comment = DB::transaction(function () use ($actor, $data, $plan, $unit) {
            $comment = StrategicPlanComment::create([
                'strategic_plan_id' => $plan->record_id,
                'responsible_unit_id' => $unit?->responsible_unit_id,
                'submitted_by' => $actor->user_id,
                'responsible_office_agency' => $unit?->responsible_office_agency ?? 'Management',
                'submitter_name' => $actor->name,
                'content' => trim($data['content']),
                'submitted_at' => now(),
            ]);
            $this->logWriter->write('strategic_plan_comment.created', [
                'resource_type' => 'strategic_plan_comment', 'resource_id' => $comment->plan_comment_id,
                'actor_user_id' => $actor->user_id, 'strategic_plan_id' => $plan->record_id,
            ]);

            return $comment;
        }, 3);

        return response()->json(['success' => true, 'message' => 'Comment saved successfully.', 'data' => $comment], 201);
    }

    private function plan(int $planId, $actor): Strategic
    {
        $plan = Strategic::whereKey($planId)->where('status', '!=', 'deleted')->firstOrFail();
        $this->plans->ensurePlanIsWithinAuthorizedScope($plan, $actor, 'You are not authorized to access this plan.', true);

        return $plan;
    }
}
