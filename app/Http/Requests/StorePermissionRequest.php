<?php

namespace App\Http\Requests;

use App\Validation\PermissionValidationRules;
use App\Validation\ValidationAttributes;

class StorePermissionRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'permission_name' => PermissionValidationRules::permissionNameRequired(),
            'description'     => PermissionValidationRules::descriptionOptional(),
            'code'            => PermissionValidationRules::codeRequired(),
            'module'          => PermissionValidationRules::moduleRequired(),
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
