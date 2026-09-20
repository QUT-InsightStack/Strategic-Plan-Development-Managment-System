<?php

namespace App\Http\Requests;

use App\Validation\ValidationAttributes;
use App\Validation\UserValidationRules;
use Illuminate\Validation\Rule;

class StoreUserRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['users.create'];
    }

    public function rules(): array
    {
        return [
            'first_name'      => ['required', 'string', 'max:255'],
            'last_name'       => ['sometimes', 'nullable', 'string', 'max:255'],
            'email'           => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('tblusers', 'email'),
            ],
            'password' => app(\App\Services\PasswordPolicyService::class)->rules(),
            'mobile'          => ['sometimes', 'nullable', 'string', 'max:20'],
            'address'         => ['sometimes', 'nullable', 'string', 'max:255'],
            'gender'          => UserValidationRules::genderOptional(),
            'date_of_birth'   => ['sometimes', 'nullable', 'date', 'before:today'],
            'profile_picture' => ['sometimes', 'nullable', 'string', 'max:255'],
            'department'      => ['sometimes', 'nullable', 'string', 'max:255'],
            'unit'            => ['sometimes', 'nullable', 'string', 'max:255'],
            'office'          => ['sometimes', 'nullable', 'string', 'max:255'],
            'position'        => ['sometimes', 'nullable', 'string', 'max:255'],
            'role_id'         => [
                'required',
                'integer',
                Rule::exists('tblroles', 'role_id'),
            ],
            'status'          => ['sometimes', 'string', Rule::in(['active', 'inactive', 'suspended'])],
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
