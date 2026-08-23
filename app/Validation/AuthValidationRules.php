<?php

namespace App\Validation;

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
}
