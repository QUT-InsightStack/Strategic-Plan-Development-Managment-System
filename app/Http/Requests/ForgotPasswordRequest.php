<?php

namespace App\Http\Requests;

use App\Validation\AuthValidationRules;
use App\Validation\ValidationAttributes;

class ForgotPasswordRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => AuthValidationRules::passwordResetEmail(),
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
