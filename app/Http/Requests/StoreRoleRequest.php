<?php

namespace App\Http\Requests;

use App\Validation\RoleValidationRules;

class StoreRoleRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['roles.manage'];
    }

    public function rules(): array
    {
        return [
            'role_name' => RoleValidationRules::roleNameRequired(),
            'description' => RoleValidationRules::descriptionOptional(),
        ];
    }
}
