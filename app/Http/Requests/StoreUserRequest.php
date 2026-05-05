<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StoreUserRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        // TODO: replace with policy check once RBAC middleware is built
        return true;
    }

    public function rules(): array
    {
        return [
            'name'       => ['required', 'string', 'max:255'],
            'email'      => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('tblusers', 'email'),
            ],
            'password'   => ['required', 'string', 'min:8', 'max:128'],
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