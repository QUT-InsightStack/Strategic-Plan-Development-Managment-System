<?php


namespace App\Http\Controllers;


use App\Http\Requests\UpdateUserRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;


class UserController extends Controller
{
    

    /**
     * Update the specific user.
     * PUT /api/users/{id}
     */
    public function update(UpdateUserRequest $request, int $id): JsonResponse
    {
        $user = User::find($id);


        if (! $user) {
            return response()->json([
                'message' => 'User not found.',
            ], 404);
        }


        $user->update($request->validated());


        return response()->json([
            'message' => 'User updated successfully.',
            'data'    => $user->fresh(),   // reload from DB
        ], 200);
    }
}