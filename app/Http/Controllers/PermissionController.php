<?php

namespace App\Http\Controllers;

use App\Http\Requests\StorePermissionRequest;
use App\Http\Requests\UpdatePermissionRequest;
use App\Services\PermissionService;
use Illuminate\Http\JsonResponse;

class PermissionController extends BaseCrudController
{
    protected $permissionService;

    public function __construct(PermissionService $permissionService)
    {
        $this->permissionService = $permissionService;
    }

    protected function getService()
    {
        return $this->permissionService;
    }

    protected function permissionPrefix(): string
    {
        return 'permissions';
    }

    public function store(StorePermissionRequest $request): JsonResponse
    {
        $record = $this->getService()->create($request->validated());

        return response()->json(['message' => 'Created', 'data' => $record], 201);
    }

    public function update(UpdatePermissionRequest $request, int $id): JsonResponse
    {
        $updated = $this->getService()->update($id, $request->validated());

        if (!$updated) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        return response()->json(['message' => 'Updated'], 200);
    }

    // index(), show(), destroy() — inherited from BaseCrudController
}
