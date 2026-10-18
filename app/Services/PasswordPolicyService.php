<?php

namespace App\Services;

use Closure;
use Illuminate\Validation\Rules\Password;

class PasswordPolicyService
{
    public function __construct(
        private readonly SystemSettingsService $settings
    ) {
    }

    public function rules(
        bool $required = true,
        bool $confirmed = false,
        bool $differentFromCurrent = false
    ): array {
        $settings = $this->settings->current();

        $password = Password::min($settings->password_min_length);

        if ($settings->password_require_mixed_case) {
            $password->mixedCase();
        }

        if ($settings->password_require_numbers) {
            $password->numbers();
        }

        if ($settings->password_require_symbols) {
            $password->symbols();
        }

        $rules = $required
            ? ['required', 'string', 'max:128']
            : ['sometimes', 'required', 'string', 'max:128'];

        if ($confirmed) {
            $rules[] = 'confirmed';
        }

        if ($differentFromCurrent) {
            $rules[] = 'different:current_password';
        }

        $rules[] = $password;

        $rules[] = function (
            string $attribute,
            mixed $value,
            Closure $fail
        ): void {
            if (! is_string($value)) {
                return;
            }

            if (
                config('hashing.driver', 'bcrypt') === 'bcrypt'
                && strlen($value) > 72
            ) {
                $fail('The password must not exceed 72 bytes.');
            }

            if (str_contains($value, "\0")) {
                $fail('The password contains an unsupported null character.');
            }

            $blocked = array_map(
                static fn (string $entry): string => mb_strtolower($entry),
                config('security.blocked_passwords', [])
            );

            if (in_array(mb_strtolower($value), $blocked, true)) {
                $fail('Choose a less commonly used password.');
            }
        };

        return $rules;
    }
}