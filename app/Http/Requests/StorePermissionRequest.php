<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StorePermissionRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'permission_name' => ['required', 'string', 'max:255'],
            'description'     => ['sometimes', 'nullable', 'string'],
            'code'            => [
                'required',
                'string',
                'max:100',
                Rule::unique('tblpermissions', 'code'),
            ],
            'module'          => ['required', 'string', 'max:100'],
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