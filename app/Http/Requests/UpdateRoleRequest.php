<?php

namespace App\Http\Requests;

use App\Models\Role;
use Illuminate\Validation\Rule;

class UpdateRoleRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['roles.manage'];
    }

    public function rules(): array
    {
        $routeRole = $this->route('role');

        $roleId = $routeRole instanceof Role
            ? $routeRole->role_id
            : $routeRole;

        return [
            'role_name' => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('tblroles', 'role_name')
                    ->ignore($roleId, 'role_id'),
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
