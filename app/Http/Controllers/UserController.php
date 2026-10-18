<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssignUserRoleRequest;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Requests\UpdateUserStatusRequest;
use App\Http\Requests\SearchUsersRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\UserRoleService;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

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

        return response()->json([
            'success' => true,
            'message' => 'User created successfully.',
            'data' => new UserResource($record),
        ], 201);
    }

    /**
     * Update another user's account.
     *
     * Role and status are rejected by UpdateUserRequest, so this cannot alter
     * either; both have dedicated endpoints. The response is shaped by
     * UserResource so no password hash or token is returned.
     */
    public function update(UpdateUserRequest $request, int $id): JsonResponse
    {
        $user = $this->userService->updateByAdministrator(
            $id,
            $request->validated(),
            Auth::guard('api')->user()
        );

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'User updated successfully.',
            'data'    => new UserResource($user),
            'reauthentication_required' => array_key_exists(
                'password',
                $request->validated()
            ),

        ], 200);
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

    public function updateStatus(
        UpdateUserStatusRequest $request,
        User $user
    ): JsonResponse {
        $updatedUser = $this->userService->updateStatus(
            (int) $user->user_id,
            $request->validated('status'),
            $request->validated('reason'),
            Auth::guard('api')->user()
        );

        return response()->json([
            'success' => true,
            'message' => 'Account status updated successfully.',
            'data' => new UserResource($updatedUser),
            'reauthentication_required' => true,
        ]);
    }

}
