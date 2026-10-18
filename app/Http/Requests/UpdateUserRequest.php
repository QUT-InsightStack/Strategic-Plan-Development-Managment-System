<?php

namespace App\Http\Requests;

use App\Validation\ValidationAttributes;
use App\Validation\UserValidationRules;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['users.update'];
    }

    public function rules(): array
    {
        $userId = $this->route('user');

        return [
            'first_name'      => ['sometimes', 'string', 'max:255'],
            'last_name'       => ['sometimes', 'nullable', 'string', 'max:255'],
            'email'           => [
                'sometimes',
                'string',
                'email',
                'max:255',
                Rule::unique('tblusers', 'email')->ignore($userId, 'user_id'),
            ],
            'password' => app(\App\Services\PasswordPolicyService::class)->rules(required: false),
            'mobile'          => ['sometimes', 'nullable', 'string', 'max:20'],
            'address'         => ['sometimes', 'nullable', 'string', 'max:255'],
            'gender'          => UserValidationRules::genderOptional(),
            'date_of_birth'   => ['sometimes', 'nullable', 'date', 'before:today'],
            'profile_picture' => ['sometimes', 'nullable', 'string', 'max:255'],
            'department'      => ['sometimes', 'nullable', 'string', 'max:255'],
            'unit'            => ['sometimes', 'nullable', 'string', 'max:255'],
            'office'          => ['sometimes', 'nullable', 'string', 'max:255'],
            'position'        => ['sometimes', 'nullable', 'string', 'max:255'],
            // Role and status each have a dedicated endpoint that applies
            // safeguards this one does not: role assignment checks privilege
            // escalation, and status changes block self-suspension, protect
            // the last administrator, and increment auth_version so existing
            // sessions are invalidated. Accepting either field here would
            // bypass all of that, so both are rejected outright.
            'role_id'         => ['missing'],
            'status'          => ['missing'],
        ];
    }

    public function messages(): array
    {
        return [
            'role_id.missing' =>
                'Roles must be changed through the role assignment endpoint.',
            'status.missing' =>
                'Account status must be changed through the account status endpoint.',
        ];
    }


    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
