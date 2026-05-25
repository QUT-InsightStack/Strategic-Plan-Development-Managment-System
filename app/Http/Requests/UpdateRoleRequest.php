<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdateRoleRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $roleId = $this->route('role');

        return [
            'role_name'   => [
                'sometimes',
                'string',
                'max:100',                              
                Rule::unique('tblroles', 'role_name')->ignore($roleId, 'role_id'),
            ],
            'description' => ['sometimes', 'nullable', 'string'],  // text column — no max
        ];
    }
}