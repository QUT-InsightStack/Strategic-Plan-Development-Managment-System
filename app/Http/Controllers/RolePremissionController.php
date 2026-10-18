<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRolePremissionRequest;
use App\Http\Requests\UpdateRolePremissionRequest;
use App\Services\PermissionAuthorizationService;
use App\Services\RolePremissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class RolePremissionController extends Controller
{
    protected $rolePremissionService;

    public function __construct(
        RolePremissionService $rolePremissionService,
        private readonly PermissionAuthorizationService $permissionAuthorizationService
    )
    {
        $this->rolePremissionService = $rolePremissionService;
    }

    public function index(Request $request): JsonResponse
    {
        $this->permissionAuthorizationService->ensureHasPermission(
            'roles.view',
            Auth::guard('api')->user(),
            'You are not authorized to view role permissions.'
        );
        $filters = $request->validate([
            'role_id'       => ['nullable', 'integer', Rule::exists('tblroles', 'role_id')],
            'permission_id' => ['nullable', 'integer', Rule::exists('tblpermissions', 'permission_id')],
        ]);

        return response()->json([
            'data' => $this->rolePremissionService->getAll($filters),
        ], 200);
    }

    public function show(int $id): JsonResponse
    {
        $this->permissionAuthorizationService->ensureHasPermission(
            'roles.view',
            Auth::guard('api')->user(),
            'You are not authorized to view role permissions.'
        );
        $rolePremission = $this->rolePremissionService->getById($id);

        if (!$rolePremission) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['data' => $rolePremission], 200);
    }

    public function store(StoreRolePremissionRequest $request): JsonResponse
    {
        $rolePremission = $this->rolePremissionService->create($request->validated());

        return response()->json(['message' => 'Created', 'data' => $rolePremission], 201);
    }

    public function update(UpdateRolePremissionRequest $request, int $id): JsonResponse
    {
        $updated = $this->rolePremissionService->update($id, $request->validated());

        if (!$updated) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        return response()->json(['message' => 'Updated'], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->permissionAuthorizationService->ensureHasPermission(
            'roles.manage',
            Auth::guard('api')->user(),
            'You are not authorized to delete role permissions.'
        );
        $deleted = $this->rolePremissionService->delete($id);

        if (!$deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['message' => 'Deleted'], 200);
    }

    public function byRole(int $roleId): JsonResponse
    {
        $this->permissionAuthorizationService->ensureHasPermission(
            'roles.view',
            Auth::guard('api')->user(),
            'You are not authorized to view role permissions.'
        );
        return response()->json([
            'data' => $this->rolePremissionService->getByRoleId($roleId),
        ], 200);
    }

    public function syncPermissions(Request $request,int $roleId): JsonResponse {
        $this->permissionAuthorizationService->ensureHasPermission(
            'roles.manage',
            Auth::guard('api')->user(),
            'You are not authorized to manage role permissions.'
        );

        $data = $request->validate([
            'permission_ids' => [
                'required',
                'array',
            ],
            'permission_ids.*' => [
                'integer',
                'distinct',
                Rule::exists(
                    'tblpermissions',
                    'permission_id'
                ),
            ],
        ]);
    
        $relations = $this->rolePremissionService
            ->syncPermissions(
                $roleId,
                $data['permission_ids']
            );
    
        return response()->json([
            'message' => 'Updated',
            'data' => $relations,
        ], 200);
    }
}
