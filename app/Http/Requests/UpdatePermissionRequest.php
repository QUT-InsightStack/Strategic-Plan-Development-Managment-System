<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

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
            'permission_name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('tblpermissions', 'permission_name')
                    ->ignore($permissionId, 'permission_id'),
            ],
            'code' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('tblpermissions', 'code')
                    ->ignore($permissionId, 'permission_id'),
            ],
            'module' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}