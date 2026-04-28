<?php

namespace App\Http\Requests;

class UpdateUserRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        
        $userId = $this->route('id');

        return [
            'name'       => ['sometimes', 'string', 'max:255'],
            'department' => ['sometimes', 'nullable', 'string', 'max:255'],
            'email'      => ['sometimes', 'email', 'max:255',
                             "unique:tblusers,email,{$userId},user_id"],
            'role_id'    => ['sometimes', 'nullable', 'integer',
                             'exists:tblroles,role_id'],
            'status'     => ['sometimes', 'in:active,inactive,suspended'],
            'password'   => ['sometimes', 'string', 'min:8'],
        ];
    }
}
