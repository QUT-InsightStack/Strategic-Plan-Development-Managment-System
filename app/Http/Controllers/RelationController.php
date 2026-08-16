<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRelationRequest;
use App\Http\Requests\UpdateRelationRequest;
use App\Services\RelationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RelationController extends Controller
{
    protected $relationService;

    public function __construct(RelationService $relationService)
    {
        $this->relationService = $relationService;
    }

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->relationService->getAll()], 200);
    }

    public function show(int $id): JsonResponse
    {
        $relation = $this->relationService->getById($id);

        if (! $relation) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['data' => $relation], 200);
    }

    public function store(StoreRelationRequest $request): JsonResponse
    {
        $relation = $this->relationService->create($request->validated());

        return response()->json(['message' => 'Created', 'data' => $relation], 201);
    }

    public function update(UpdateRelationRequest $request, int $id): JsonResponse
    {
        $updated = $this->relationService->update($id, $request->validated());

        if (! $updated) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        return response()->json(['message' => 'Updated', 'data' => $updated], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $deleted = $this->relationService->delete($id);

        if (! $deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['message' => 'Deleted'], 200);
    }

    public function byRecord(int $recordId): JsonResponse
    {
        return response()->json([
            'data' => $this->relationService->getByRecordId($recordId),
        ], 200);
    }

    public function syncParents(Request $request, int $recordId): JsonResponse
    {
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
