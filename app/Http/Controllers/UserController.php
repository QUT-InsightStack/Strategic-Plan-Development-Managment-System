<?php

namespace App\Http\Controllers;

use App\Http\Requests\SearchUserRequest;
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

    /**
     * Search users by name, email or role.
     *
     * Returns a paginated summary. Only the fields an administrator needs to
     * identify an account are exposed; the password hash and remember token
     * are hidden on the model and additionally never selected here.
     *
     * Inactive and suspended accounts are included, with status returned so
     * the caller can label them.
     */
    public function search(SearchUserRequest $request): JsonResponse
    {
        $results = $this->getService()->searchUsers($request->filters());

        return response()->json([
            'success' => true,
            'data'    => collect($results->items())->map(fn ($user) => [
                'user_id'    => $user->user_id,
                'first_name' => $user->first_name,
                'last_name'  => $user->last_name,
                'email'      => $user->email,
                'department' => $user->department,
                'unit'       => $user->unit,
                'office'     => $user->office,
                'position'   => $user->position,
                'status'     => $user->status,
                'role_id'    => $user->role_id,
                'role_name'  => $user->role?->role_name,
            ])->all(),
            'meta'    => [
                'current_page' => $results->currentPage(),
                'last_page'    => $results->lastPage(),
                'per_page'     => $results->perPage(),
                'total'        => $results->total(),
                'from'         => $results->firstItem(),
                'to'           => $results->lastItem(),
            ],
        ], 200);
    }

    /**
     * Distinct unit, office and department values for the search filters.
     *
     * Behind the same authorisation as search itself, since the values reveal
     * the organisation's internal structure.
     */
    public function searchFilterOptions(SearchUserRequest $request): JsonResponse
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
}