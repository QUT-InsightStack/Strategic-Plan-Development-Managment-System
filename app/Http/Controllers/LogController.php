<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLogRequest;
use App\Http\Requests\UpdateLogRequest;
use App\Services\PermissionAuthorizationService;
use App\Services\LogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class LogController extends Controller
{
    protected $logService;

    public function __construct(
        LogService $logService,
        private readonly PermissionAuthorizationService $permissionAuthorizationService
    )
    {
        $this->logService = $logService;
    }

    // GET filter validation kept inline — read-only filter, not a write operation
    public function index(Request $request): JsonResponse
    {
        $this->permissionAuthorizationService->ensureHasPermission(
            'logs.view',
            Auth::guard('api')->user(),
            'You are not authorized to view logs.'
        );
        $filters = $request->validate([
            'user_id' => ['nullable', 'integer', Rule::exists('tblusers', 'user_id')],
            'states'  => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json([
            'data' => $this->logService->getAll($filters),
        ], 200);
    }

    public function show(int $id): JsonResponse
    {
        $this->permissionAuthorizationService->ensureHasPermission(
            'logs.view',
            Auth::guard('api')->user(),
            'You are not authorized to view logs.'
        );
        $log = $this->logService->getById($id);

        if (!$log) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['data' => $log], 200);
    }

    public function store(StoreLogRequest $request): JsonResponse
    {
        $log = $this->logService->create($request->validated());

        return response()->json(['message' => 'Created', 'data' => $log], 201);
    }

    public function update(UpdateLogRequest $request, int $id): JsonResponse
    {
        $updated = $this->logService->update($id, $request->validated());

        if (!$updated) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        return response()->json(['message' => 'Updated'], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->permissionAuthorizationService->ensureHasPermission(
            'logs.delete',
            Auth::guard('api')->user(),
            'You are not authorized to delete logs.'
        );
        $deleted = $this->logService->delete($id);

        if (!$deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['message' => 'Deleted'], 200);
    }
}
