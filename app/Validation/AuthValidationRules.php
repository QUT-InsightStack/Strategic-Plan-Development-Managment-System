<?php

namespace App\Validation;

use Illuminate\Validation\Rules\Password;

class AuthValidationRules
{
    public static function loginEmail(): array
    {
        return ['required', 'string', 'email', 'max:255'];
    }

    public static function loginPassword(): array
    {
        return ['required', 'string'];
    }

    public static function passwordResetEmail(): array
    {
        return ['required', 'string', 'email', 'max:255'];
    }

    public static function newPassword(): array
    {
        return [
            'required',
            'string',
            'confirmed',
            'different:current_password',
            Password::min(16)
                ->letters()
                ->mixedCase()
                ->numbers()
                ->symbols(),
        ];
    }
}
