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
            'permission_name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('tblpermissions', 'permission_name'),
            ],
            'code' => [
                'required',
                'string',
                'max:255',
                Rule::unique('tblpermissions', 'code'),
            ],
            'module' => ['required', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}