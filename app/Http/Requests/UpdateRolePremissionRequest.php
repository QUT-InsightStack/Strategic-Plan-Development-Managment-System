<?php

namespace App\Http\Requests;

use App\Models\RolePremission;
use Illuminate\Validation\Rule;

class UpdateRolePremissionRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Route::apiResource('role-premissions', ...) → parameter: {role_premission}
        $rolePremissionId = $this->route('role_premission');
        $existing         = RolePremission::find($rolePremissionId);
        $roleId           = $this->input('role_id', $existing?->role_id);

        return [
            'role_id' => [
                'sometimes',
                'integer',
                Rule::exists('tblroles', 'role_id'),
            ],
            'permission_id' => [
                'sometimes',
                'integer',
                Rule::exists('tblpermissions', 'permission_id'),
                Rule::unique('tblrole_permissions')
                    ->where('role_id', $roleId)
                    ->ignore($rolePremissionId, 'relation_id'),
            ],
        ];
    }
}
