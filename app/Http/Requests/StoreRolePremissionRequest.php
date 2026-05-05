<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StoreRolePremissionRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $roleId = $this->input('role_id');

        return [
            'role_id' => [
                'required',
                'integer',
                Rule::exists('tblroles', 'role_id'),
            ],
            'permission_id' => [
                'required',
                'integer',
                Rule::exists('tblpermissions', 'permission_id'),
                // Prevent duplicate role+permission pair
                Rule::unique('tblrole_permissions')->where('role_id', $roleId),
            ],
        ];
    }
}