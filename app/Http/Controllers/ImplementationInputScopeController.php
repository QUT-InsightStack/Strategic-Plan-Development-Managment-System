<?php

namespace App\Http\Controllers;

use App\Contracts\StrategicLogWriter;
use App\Models\Strategic;
use App\Models\User;
use App\Services\ImplementationInputAccessService;
use App\Services\PermissionAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ImplementationInputScopeController extends Controller
{
    public function __construct(
        private readonly PermissionAuthorizationService $permissions,
        private readonly ImplementationInputAccessService $access,
        private readonly StrategicLogWriter $logWriter,
    ) {}

    public function show(Request $request, int $planId): JsonResponse
    {
        $this->permissions->ensureHasPermission('implementation_inputs.manage_scope', $request->user('api'));
        Strategic::where('status', '!=', 'deleted')->findOrFail($planId);

        return response()->json(['success' => true, 'data' => $this->userIds($planId)]);
    }

    public function update(Request $request, int $planId): JsonResponse
    {
        $actor = $this->permissions->ensureHasPermission('implementation_inputs.manage_scope', $request->user('api'));
        $data = $request->validate(['user_ids' => ['present', 'array', 'max:500'], 'user_ids.*' => ['required', 'integer', 'distinct', 'exists:tblusers,user_id']]);

        return DB::transaction(function () use ($planId, $data, $actor) {
            Strategic::where('status', '!=', 'deleted')->lockForUpdate()->findOrFail($planId);
            foreach (User::with('role.permissions')->whereIn('user_id', $data['user_ids'])->get() as $user) {
                if ($user->status !== 'active' || ! $this->access->viewsPlanningScope($user)) {
                    throw ValidationException::withMessages(['user_ids' => ['Scope recipients must be active users with planning input view permission.']]);
                }
            }
            $before = $this->userIds($planId);
            $after = array_map('intval', $data['user_ids']);
            sort($after);
            if ($before !== $after) {
                DB::table('tblimplementation_input_scopes')->where('strategic_plan_id', $planId)->whereNotIn('user_id', $after)->delete();
                foreach (array_diff($after, $before) as $id) {
                    DB::table('tblimplementation_input_scopes')->insert([
                        'strategic_plan_id' => $planId, 'user_id' => $id, 'granted_by' => $actor->user_id,
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                }
                $this->logWriter->write('implementation_input.scope_updated', [
                    'actor_user_id' => $actor->user_id, 'resource_type' => 'strategic_plan', 'resource_id' => $planId,
                    'before' => $before, 'after' => $after,
                ]);
            }

            return response()->json(['success' => true, 'data' => $after]);
        }, 3);
    }

    private function userIds(int $planId): array
    {
        return DB::table('tblimplementation_input_scopes')->where('strategic_plan_id', $planId)
            ->orderBy('user_id')->pluck('user_id')->map(fn ($id) => (int) $id)->all();
    }
}
