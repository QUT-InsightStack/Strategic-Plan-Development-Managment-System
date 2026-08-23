<?php

namespace App\Http\Requests;

use App\Models\RolePremission;
use App\Validation\RolePermissionValidationRules;

class UpdateRolePremissionRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['role_permissions.update'];
    }

    public function rules(): array
    {
        $rolePremissionId = $this->route('role_premission');
        $existing = RolePremission::find($rolePremissionId);
        $roleId = $this->input('role_id', $existing?->role_id);

        return [
            'role_id' => RolePermissionValidationRules::roleIdOptional(),
            'permission_id' => RolePermissionValidationRules::permissionIdOptional($roleId, $rolePremissionId),
        ];
    }
}
