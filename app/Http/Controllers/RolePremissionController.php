<?php

namespace App\Http\Controllers;

use App\Models\RolePremission;
use App\Services\RolePremissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RolePremissionController extends Controller
{
    protected $rolePremissionService;

    public function __construct(RolePremissionService $rolePremissionService)
    {
        $this->rolePremissionService = $rolePremissionService;
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'role_id' => ['nullable', 'integer', Rule::exists('tblroles', 'role_id')],
            'permission_id' => ['nullable', 'integer', Rule::exists('tblpermissions', 'permission_id')],
        ]);

        return response()->json([
            'data' => $this->rolePremissionService->getAll($filters),
        ], 200);
    }

    public function show(int $id): JsonResponse
    {
        $rolePremission = $this->rolePremissionService->getById($id);

        if (!$rolePremission) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['data' => $rolePremission], 200);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $rolePremission = $this->rolePremissionService->create($data);

        return response()->json(['message' => 'Created', 'data' => $rolePremission], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $rolePremission = RolePremission::find($id);

        if (!$rolePremission) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $data = $request->validate($this->rules($rolePremission));
        $updated = $this->rolePremissionService->update($id, $data);

        return response()->json(['message' => 'Updated', 'data' => $updated], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $deleted = $this->rolePremissionService->delete($id);

        if (!$deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['message' => 'Deleted'], 200);
    }

    public function byRole(int $roleId): JsonResponse
    {
        return response()->json([
            'data' => $this->rolePremissionService->getByRoleId($roleId),
        ], 200);
    }

    public function syncPermissions(Request $request, int $roleId): JsonResponse
    {
        $data = $request->validate([
            'permission_ids' => ['array'],
            'permission_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('tblpermissions', 'permission_id'),
            ],
        ]);

        $relations = $this->rolePremissionService->syncPermissions(
            $roleId,
            $data['permission_ids'] ?? []
        );

        return response()->json(['message' => 'Updated', 'data' => $relations], 200);
    }

    protected function rules(?RolePremission $rolePremission = null): array
    {
        $roleId = request('role_id', $rolePremission?->role_id);

        return [
            'role_id' => [
                $rolePremission ? 'sometimes' : 'required',
                'integer',
                Rule::exists('tblroles', 'role_id'),
            ],
            'permission_id' => [
                $rolePremission ? 'sometimes' : 'required',
                'integer',
                Rule::exists('tblpermissions', 'permission_id'),
                Rule::unique('tblrole_permissions')
                    ->where('role_id', $roleId)
                    ->ignore($rolePremission?->relation_id, 'relation_id'),
            ],
        ];
    }
}
