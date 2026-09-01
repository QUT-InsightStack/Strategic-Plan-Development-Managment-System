<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreRoleRequest;
use App\Http\Requests\UpdateRoleRequest;
use App\Services\RoleService;
use Illuminate\Http\JsonResponse;

class RoleController extends BaseCrudController
{
    protected $roleService;

    public function __construct(RoleService $roleService)
    {
        $this->roleService = $roleService;
    }

    protected function getService()
    {
        return $this->roleService;
    }

    protected function permissionPrefix(): string
    {
        return 'roles';
    }

    public function store(StoreRoleRequest $request): JsonResponse
    {
        $record = $this->getService()->create($request->validated());
        return response()->json(['message' => 'Created', 'data' => $record], 201);
    }

    public function update(UpdateRoleRequest $request, int $id): JsonResponse
    {
        $updated = $this->getService()->update($id, $request->validated());

        if (! $updated) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        return response()->json(['message' => 'Updated'], 200);
    }

    /**
     * Role creation, update, and deletion are all governed by
     * the roles.manage permission.
     *
     * This overrides BaseCrudController::destroy(), which
     * requires roles.delete.
     */
    public function destroy(int $id): JsonResponse
    {
        app(\App\Services\PermissionAuthorizationService::class)
            ->ensureHasPermission(
                'roles.manage',
                auth('api')->user(),
                'You are not authorized to manage roles.'
            );


        $deleted = $this->getService()->delete($id);


        if (! $deleted) {
            return response()->json([
                'message' => 'Not found',
            ], 404);
        }


        return response()->json([
            'message' => 'Deleted',
        ], 200);
    }

}
