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
            'permission_name' => ['sometimes', 'string', 'max:255'],
            'description'     => ['sometimes', 'nullable', 'string'],
            'code'            => [
                'sometimes',
                'string',
                'max:100',
                Rule::unique('tblpermissions', 'code')
                    ->ignore($permissionId, 'permission_id'),
            ],
            'module'          => ['sometimes', 'string', 'max:100'],
        ];
    }

    public function attributes(): array
    {
        return [
            'permission_name' => 'permission name',
            'code'            => 'permission code',
        ];
    }
}