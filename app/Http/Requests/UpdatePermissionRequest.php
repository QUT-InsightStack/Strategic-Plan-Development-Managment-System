<?php

namespace App\Http\Requests;

use App\Validation\PermissionValidationRules;
use App\Validation\ValidationAttributes;

class UpdatePermissionRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $permissionId = $this->route('permission');

        return [
            'permission_name' => PermissionValidationRules::permissionNameOptional(),
            'description'     => PermissionValidationRules::descriptionOptional(),
            'code'            => PermissionValidationRules::codeOptional($permissionId),
            'module'          => PermissionValidationRules::moduleOptional(),
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
