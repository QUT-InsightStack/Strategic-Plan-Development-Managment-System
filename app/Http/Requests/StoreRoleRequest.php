<?php

namespace App\Http\Requests;

use App\Validation\RoleValidationRules;

class StoreRoleRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'role_name' => RoleValidationRules::roleNameRequired(),
            'description' => RoleValidationRules::descriptionOptional(),
        ];
    }
}
