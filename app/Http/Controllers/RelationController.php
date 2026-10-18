<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRelationRequest;
use App\Http\Requests\UpdateRelationRequest;
use App\Models\Strategic;
use App\Services\PermissionAuthorizationService;
use App\Services\RelationService;
use App\Services\StrategicPlanAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class RelationController extends Controller
{
    public function __construct(
        protected RelationService $relationService,
        private readonly StrategicPlanAuthorizationService $authorizationService,
        private readonly PermissionAuthorizationService $permissionAuthorizationService
    ) {
    }

    public function index(): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'relations.view',
            $user,
            'You are not authorized to view strategic plan relations.'
        );
        $authorizedPlanIds = $this->authorizationService->authorizedPlanIdsForListing($user);

        return response()->json([
            'data' => $this->relationService->getAll($authorizedPlanIds),
        ], 200);
    }

    public function show(int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'relations.view',
            $user,
            'You are not authorized to view strategic plan relations.'
        );
        $relation = $this->relationService->getById($id);

        if (! $relation) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if (! $relation->record || $relation->record->status === 'deleted') {
            return response()->json(['message' => 'Not found'], 404);
        }

        $relation->record?->loadMissing('creator');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $relation->record,
            $user,
            'You are not authorized to view this strategic plan relation.'
        );

        return response()->json(['data' => $relation], 200);
    }

    public function store(StoreRelationRequest $request): JsonResponse
    {
        $record = Strategic::with('creator')
            ->where('status', '!=', 'deleted')
            ->findOrFail($request->validated('record_id'));
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $record,
            Auth::guard('api')->user(),
            'You are not authorized to create relations for this strategic plan.'
        );
        $relation = $this->relationService->create($request->validated());

        return response()->json(['message' => 'Created', 'data' => $relation], 201);
    }

    public function update(UpdateRelationRequest $request, int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $relation = $this->relationService->getById($id);

        if (! $relation) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        $recordId = $request->validated('record_id') ?? $relation->record_id;
        $record = Strategic::with('creator')
            ->where('status', '!=', 'deleted')
            ->findOrFail($recordId);
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $record,
            $user,
            'You are not authorized to update relations for this strategic plan.'
        );
        $updated = $this->relationService->update($id, $request->validated());

        if (! $updated) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        return response()->json(['message' => 'Updated', 'data' => $updated], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'relations.delete',
            $user,
            'You are not authorized to delete strategic plan relations.'
        );
        $relation = $this->relationService->getById($id);

        if (! $relation) {
            return response()->json(['message' => 'Not found'], 404);
        }

        if (! $relation->record || $relation->record->status === 'deleted') {
            return response()->json(['message' => 'Not found'], 404);
        }

        $relation->record?->loadMissing('creator');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $relation->record,
            $user,
            'You are not authorized to delete this strategic plan relation.'
        );
        $deleted = $this->relationService->delete($id);

        if (! $deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['message' => 'Deleted'], 200);
    }

    public function byRecord(int $recordId): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'relations.view',
            $user,
            'You are not authorized to view strategic plan relations.'
        );
        $record = Strategic::with('creator')
            ->whereKey($recordId)
            ->where('status', '!=', 'deleted')
            ->first();
        abort_if(! $record, 404, 'Strategic plan not found.');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $record,
            $user,
            'You are not authorized to view relations for this strategic plan.'
        );

        return response()->json([
            'data' => $this->relationService->getByRecordId($recordId),
        ], 200);
    }

    public function syncParents(Request $request, int $recordId): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $this->permissionAuthorizationService->ensureHasPermission(
            'relations.update',
            $user,
            'You are not authorized to update strategic plan relations.'
        );
        $record = Strategic::with('creator')
            ->whereKey($recordId)
            ->where('status', '!=', 'deleted')
            ->first();
        abort_if(! $record, 404, 'Strategic plan not found.');
        $this->authorizationService->ensurePlanIsWithinAuthorizedScope(
            $record,
            $user,
            'You are not authorized to update relations for this strategic plan.'
        );

        $data = $request->validate([
            'parent_ids'   => ['array'],
            'parent_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('tblstrategic_record', 'record_id')->where(
                    fn ($query) => $query->where('status', '!=', 'deleted')
                ),
                Rule::notIn([$recordId]),
            ],
            'created_by' => ['required', 'integer', Rule::exists('tblusers', 'user_id')],
        ]);

        $relations = $this->relationService->syncParents(
            $recordId,
            $data['parent_ids'] ?? [],
            $data['created_by']
        );

        return response()->json(['message' => 'Updated', 'data' => $relations], 200);
    }
}
