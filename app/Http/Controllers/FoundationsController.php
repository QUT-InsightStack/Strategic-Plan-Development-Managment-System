<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreFoundationsRequest;
use App\Http\Requests\UpdateFoundationsRequest;
use App\Services\PermissionAuthorizationService;
use App\Services\FoundationsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class FoundationsController extends Controller
{
    protected $foundationsService;

    public function __construct(
        FoundationsService $foundationsService,
        private readonly PermissionAuthorizationService $permissionAuthorizationService
    )
    {
        $this->foundationsService = $foundationsService;
    }

    public function index(Request $request): JsonResponse
    {
        $this->permissionAuthorizationService->ensureHasPermission(
            'strategic_foundations.view',
            Auth::guard('api')->user(),
            'You are not authorized to view strategic foundations.'
        );
        $data = $request->validate([
            'type' => ['nullable', 'string', Rule::in(['MISSION', 'VISION', 'CORE_VALUE'])],
        ]);

        return response()->json([
            'data' => $this->foundationsService->getAll($data['type'] ?? null),
        ], 200);
    }

    public function show(int $id): JsonResponse
    {
        $this->permissionAuthorizationService->ensureHasPermission(
            'strategic_foundations.view',
            Auth::guard('api')->user(),
            'You are not authorized to view strategic foundations.'
        );
        $foundation = $this->foundationsService->getById($id);

        if (!$foundation) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['data' => $foundation], 200);
    }

    public function store(StoreFoundationsRequest $request): JsonResponse
    {
        $foundation = $this->foundationsService->create($request->validated());

        return response()->json(['message' => 'Created', 'data' => $foundation], 201);
    }

    public function update(UpdateFoundationsRequest $request, int $id): JsonResponse
    {
        $updated = $this->foundationsService->update($id, $request->validated());

        if (!$updated) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        return response()->json(['message' => 'Updated'], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->permissionAuthorizationService->ensureHasPermission(
            'strategic_foundations.delete',
            Auth::guard('api')->user(),
            'You are not authorized to delete strategic foundations.'
        );
        $deleted = $this->foundationsService->delete($id);

        if (!$deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['message' => 'Deleted'], 200);
    }
}
