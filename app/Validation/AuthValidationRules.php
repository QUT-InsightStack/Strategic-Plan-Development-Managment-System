<?php

namespace App\Validation;

use App\Services\PasswordPolicyService;

class AuthValidationRules
{
    public static function loginEmail(): array
    {
        return ['required', 'string', 'email', 'max:255'];
    }

    public static function loginPassword(): array
    {
        /*
         * do not apply today's password policy to existing credentials.
         */
        return ['required', 'string'];
    }

    public static function passwordResetEmail(): array
    {
        return ['required', 'string', 'email', 'max:255'];
    }

    public static function newPassword(): array
    {
        return app(PasswordPolicyService::class)->rules(
            required: true,
            confirmed: true,
            differentFromCurrent: true
        );
    }
}