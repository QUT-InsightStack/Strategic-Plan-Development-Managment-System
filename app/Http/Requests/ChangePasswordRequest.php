<?php

namespace App\Http\Requests;

use App\Validation\AuthValidationRules;
use App\Validation\ValidationAttributes;

class ChangePasswordRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string'],
            'new_password' => AuthValidationRules::newPassword(),
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
