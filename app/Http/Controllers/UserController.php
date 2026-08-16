<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;

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

    protected function permissionPrefix(): string
    {
        return 'users';
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
