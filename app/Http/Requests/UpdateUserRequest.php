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
        // $this->route('user') gives the {user} URL parameter
        $userId = $this->route('user');

        return [
            'name'       => ['sometimes', 'string', 'max:255'],
            'email'      => [
                'sometimes',
                'string',
                'email',
                'max:255',
                Rule::unique('tblusers', 'email')->ignore($userId, 'user_id'),
            ],
            'password'   => ['sometimes', 'string', 'min:8', 'max:128'],
            'department' => ['sometimes', 'nullable', 'string', 'max:255'],
            'role_id'    => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('tblroles', 'role_id'),
            ],
            'status'     => ['sometimes', 'string', Rule::in(['active', 'inactive', 'suspended'])],
        ];
    }

    public function attributes(): array
    {
        return [
            'role_id' => 'role',
            'email'   => 'email address',
        ];
    }
}