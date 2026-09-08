<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\ValidationException;

abstract class ApiFormRequest extends FormRequest
{
    /**
     * All API requests require authentication by default.
     * Override in specific request classes where public access is needed.
     */
    public function authorize(): bool
    {
        $user = auth('api')->user();

        if (! $user) {
            return false;
        }

        if ($user->role?->role_name === 'Administrator') {
            return true;
        }

        $requiredPermissions = $this->requiredPermissions();

        if (empty($requiredPermissions)) {
            return true;
        }

        $effectivePermissions = $this->userPermissionCodes($user);

        foreach ($requiredPermissions as $permission) {
            if ($effectivePermissions->contains($permission)) {
                return true;
            }
        }

        return false;
    }

    protected function requiredPermissions(): array
    {
        return [];
    }

    protected function hasPermission(string $permission): bool
    {
        $user = auth('api')->user();

        if (! $user) {
            return false;
        }

        return $this->userPermissionCodes($user)->contains($permission);
    }

    protected function userPermissionCodes($user): \Illuminate\Support\Collection
    {
        $role = $user->loadMissing('role.permissions')->role;

        if (! $role) {
            return collect();
        }

        return $role->permissions->pluck('code');
    }


    /**
     * Return JSON validation errors instead of an HTML redirect.
     *  — without this override, Laravel redirects back
     * to a previous page, which breaks a React SPA completely.
     */
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(
            response()->json(
                [
                    'success' => false,
                    'message' => 'Validation failed.',
                    'errors'  => $validator->errors(),
                ],
                422
            )
        );
    }

    /**
     * Return JSON 403 when authorize() returns false,
     * instead of Laravel's default HTML forbidden page.
     */
    protected function failedAuthorization(): void
    {
        throw new HttpResponseException(
            response()->json(
                [
                    'success' => false,
                    'message' => 'This action is unauthorized.',
                    'errors'  => [],
                ],
                403
            )
        );
    }
}
