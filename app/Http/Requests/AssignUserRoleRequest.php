<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class AssignUserRoleRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'role_id' => [
                'required',
                'integer',
                Rule::exists('tblroles', 'role_id'),
            ],
        ];
    }

    public function attributes(): array
    {
        return [
            'role_id' => 'role',
        ];
    }
}
