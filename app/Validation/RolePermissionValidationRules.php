<?php

namespace App\Validation;

use Illuminate\Validation\Rule;

class RolePermissionValidationRules
{
    public static function roleIdRequired(): array
    {
        return ['required', 'integer', Rule::exists('tblroles', 'role_id')];
    }

    public static function roleIdOptional(): array
    {
        return ['sometimes', 'integer', Rule::exists('tblroles', 'role_id')];
    }

    public static function permissionIdRequired(mixed $roleId): array
    {
        return ['required', 'integer', Rule::exists('tblpermissions', 'permission_id'), Rule::unique('tblrole_permissions')->where('role_id', $roleId)];
    }

    public static function permissionIdOptional(mixed $roleId, mixed $rolePermissionId): array
    {
        return ['sometimes', 'integer', Rule::exists('tblpermissions', 'permission_id'), Rule::unique('tblrole_permissions')->where('role_id', $roleId)->ignore($rolePermissionId, 'relation_id')];
    }
}
