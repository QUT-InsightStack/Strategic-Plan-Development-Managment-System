<?php

namespace App\Http\Requests;

use App\Validation\AuthValidationRules;
use App\Validation\ValidationAttributes;

class ResetPasswordRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'token' => ['required', 'string'],
            'email' => AuthValidationRules::passwordResetEmail(),
            'password' => [
                ...array_filter(
                    AuthValidationRules::newPassword(),
                    static fn (mixed $rule): bool => $rule !== 'different:current_password'
                ),
            ],
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
