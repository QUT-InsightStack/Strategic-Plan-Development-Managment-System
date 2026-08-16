<?php

namespace App\Http\Requests;

use App\Validation\RoleValidationRules;

class UpdateRoleRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['roles.manage'];
    }

    public function rules(): array
    {
        $roleId = $this->route('role');

        return [
            'role_name' => RoleValidationRules::roleNameOptional($roleId),
            'description' => RoleValidationRules::descriptionOptional(),
        ];
    }
}
