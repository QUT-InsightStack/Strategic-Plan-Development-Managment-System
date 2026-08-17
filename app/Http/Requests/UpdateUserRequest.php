<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdateUserRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
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
            'password'        => ['sometimes', 'string', 'min:8', 'max:128'],
            'mobile'          => ['sometimes', 'nullable', 'string', 'max:20'],
            'address'         => ['sometimes', 'nullable', 'string', 'max:255'],
            'gender'          => ['sometimes', 'nullable', 'boolean'],
            'date_of_birth'   => ['sometimes', 'nullable', 'date', 'before:today'],
            'profile_picture' => ['sometimes', 'nullable', 'string', 'max:255'],
            'department'      => ['sometimes', 'nullable', 'string', 'max:255'],
            'unit'            => ['sometimes', 'nullable', 'string', 'max:255'],
            'office'          => ['sometimes', 'nullable', 'string', 'max:255'],
            'position'        => ['sometimes', 'nullable', 'string', 'max:255'],
            'role_id'         => ['missing'],
            'status'          => ['sometimes', 'string', Rule::in(['active', 'inactive', 'suspended'])],
        ];
    }

    public function messages(): array
    {
        return [
            'role_id.missing' =>
                'Roles must be changed through the role assignment endpoint.',
        ];
    }


    public function attributes(): array
    {
        return [
            'first_name'    => 'first name',
            'last_name'     => 'last name',
            'date_of_birth' => 'date of birth',
            'role_id'       => 'role',
            'email'         => 'email address',
        ];
    }
}