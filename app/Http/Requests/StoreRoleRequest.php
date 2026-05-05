<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StoreRoleRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'role_name'   => [
                'required',
                'string',
                'max:255',
                Rule::unique('tblroles', 'role_name'),
            ],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}