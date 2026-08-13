<?php

namespace App\Http\Requests;

use App\Validation\RolePermissionValidationRules;

class StoreRolePremissionRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $roleId = $this->input('role_id');

        return [
            'role_id' => RolePermissionValidationRules::roleIdRequired(),
            'permission_id' => RolePermissionValidationRules::permissionIdRequired($roleId),
        ];
    }
}
