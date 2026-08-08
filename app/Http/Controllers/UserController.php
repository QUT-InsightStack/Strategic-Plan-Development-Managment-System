<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssignUserRoleRequest;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class UserController extends BaseCrudController
{
    protected $userService;

    public function __construct(UserService $userService)
    {
        $this->userService = $userService;
    }

    protected function getService()
    {
        return $this->userService;
    }

    /**
     * Assign or remove a user's role.
     *
     * Authorisation and the escalation rules are enforced in
     * AssignUserRoleRequest, so a crafted request cannot bypass them by
     * skipping the UI.
     */
    public function assignRole(AssignUserRoleRequest $request, int $id): JsonResponse
    {
        $actorId = Auth::guard('api')->user()->user_id;
        $updated = $this->getService()->assignRole($id, $request->validated()['role_id'], $actorId);

        if (! $updated) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => $updated->role
                ? "Role updated to {$updated->role->role_name}."
                : 'Role removed.',
            'data'    => [
                'user_id'   => $updated->user_id,
                'email'     => $updated->email,
                'role_id'   => $updated->role_id,
                'role_name' => $updated->role?->role_name,
            ],
        ], 200);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $record = $this->getService()->create($request->validated());
        return response()->json(['message' => 'Created', 'data' => $record], 201);
    }

    public function update(UpdateUserRequest $request, int $id): JsonResponse
    {
        $updated = $this->getService()->update($id, $request->validated());

        if (! $updated) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        return response()->json(['message' => 'Updated'], 200);
    }
}