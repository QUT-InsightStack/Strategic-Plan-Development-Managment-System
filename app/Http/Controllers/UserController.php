<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssignUserRoleRequest;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Requests\SearchUsersRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\UserRoleService;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;

class UserController extends BaseCrudController
{
    protected $userService;

    public function __construct(UserService $userService,protected UserRoleService $userRoleService) {
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

    /**
     * Distinct unit, office and department values for the search filters.
     *
     * Behind the same authorisation as search itself, since the values reveal
     * the organisation's internal structure.
     */
    public function searchFilterOptions(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data'    => $this->getService()->getSearchFilterOptions(),
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

    public function search(SearchUsersRequest $request): JsonResponse
    {
        $users = $this->userService->search(
            $request->validated()
        );

        return response()->json([
            'message' => 'Users retrieved successfully.',
            'data' => UserResource::collection(
                collect($users->items())
            )->resolve($request),
            'meta'    => [
                'current_page' => $users->currentPage(),
                'from'         => $users->firstItem(),
                'last_page'    => $users->lastPage(),
                'per_page'     => $users->perPage(),
                'to'           => $users->lastItem(),
                'total'        => $users->total(),
            ],
            'links' => [
                'first' => $users->url(1),
                'last'  => $users->url($users->lastPage()),
                'prev'  => $users->previousPageUrl(),
                'next'  => $users->nextPageUrl(),
            ],
        ], 200);
    }

    public function assignRole(
        AssignUserRoleRequest $request,
        User $user
    ): JsonResponse {
        $updatedUser = $this->userRoleService->assignRole(
            (int) $user->user_id,
            (int) $request->validated('role_id')
        );


        return response()->json([
            'message' => 'Role assigned successfully.',
            'data' => new UserResource($updatedUser),
            'reauthentication_required' => true,
        ], 200);
    }

}
