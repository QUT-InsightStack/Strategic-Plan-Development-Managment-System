<?php

namespace App\Validation;

use Illuminate\Validation\Rule;

class RoleValidationRules
{
    public static function roleNameRequired(): array
    {
        return ['required', 'string', 'max:100', Rule::unique('tblroles', 'role_name')];
    }

    public static function roleNameOptional(mixed $roleId): array
    {
        return ['sometimes', 'string', 'max:100', Rule::unique('tblroles', 'role_name')->ignore($roleId, 'role_id')];
    }

    public static function descriptionOptional(): array
    {
        return ['sometimes', 'nullable', 'string'];
    }
}
