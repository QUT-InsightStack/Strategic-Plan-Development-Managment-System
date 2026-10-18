<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StoreRoleRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['roles.manage'];
    }

    public function rules(): array
    {
        return [
            'role_name' => [
                'required',
                'string',
                'max:100',
                Rule::unique('tblroles', 'role_name'),
            ],
            'description' => [
                'sometimes',
                'nullable',
                'string',
            ],
            'is_assignable' => [
                'sometimes',
                'boolean',
            ],
            'is_protected' => [
                'sometimes',
                'boolean',
            ],
        ];
    }

    public function attributes(): array
    {
        return [
            'role_name' => 'role name',
            'is_assignable' => 'assignable status',
            'is_protected' => 'protected status',
        ];
    }
}
