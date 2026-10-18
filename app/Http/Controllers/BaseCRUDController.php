<?php

namespace App\Http\Controllers;

use App\Services\PermissionAuthorizationService;
use Illuminate\Http\JsonResponse;

abstract class BaseCrudController extends Controller
{
    abstract protected function getService();
    abstract protected function permissionPrefix(): string;

    protected function authorizeView(): void
    {
        app(PermissionAuthorizationService::class)->ensureHasPermission(
            $this->permissionPrefix() . '.view'
        );
    }

    protected function authorizeDelete(): void
    {
        app(PermissionAuthorizationService::class)->ensureHasPermission(
            $this->permissionPrefix() . '.delete'
        );
    }

    public function index(): JsonResponse
    {
        $this->authorizeView();
        $data = $this->getService()->getAll();
        return response()->json(['data' => $data], 200);
    }

    public function show(int $id): JsonResponse
    {
        $this->authorizeView();
        $record = $this->getService()->getById($id);
        if (!$record) {
            return response()->json(['message' => 'Not found'], 404);
        }
        return response()->json(['data' => $record], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorizeDelete();
        $deleted = $this->getService()->delete($id);
        if (!$deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }
        return response()->json(['message' => 'Deleted'], 200);
    }
}
