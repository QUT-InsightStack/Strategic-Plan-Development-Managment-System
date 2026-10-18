<?php

namespace App\Validation;

use Illuminate\Validation\Rule;

class PermissionValidationRules
{
    public static function permissionNameRequired(): array
    {
        return ['required', 'string', 'max:255'];
    }

    public static function permissionNameOptional(): array
    {
        return ['sometimes', 'string', 'max:255'];
    }

    public static function descriptionOptional(): array
    {
        return ['sometimes', 'nullable', 'string'];
    }

    public static function codeRequired(): array
    {
        return ['required', 'string', 'max:100', Rule::unique('tblpermissions', 'code')];
    }

    public static function codeOptional(mixed $permissionId): array
    {
        return ['sometimes', 'string', 'max:100', Rule::unique('tblpermissions', 'code')->ignore($permissionId, 'permission_id')];
    }

    public static function moduleRequired(): array
    {
        return ['required', 'string', 'max:100'];
    }

    public static function moduleOptional(): array
    {
        return ['sometimes', 'string', 'max:100'];
    }
}
