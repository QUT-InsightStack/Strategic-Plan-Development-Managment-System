<?php

namespace App\Validation;

use Illuminate\Validation\Rule;

class LogValidationRules
{
    public static function userIdRequired(): array
    {
        return ['required', 'integer', Rule::exists('tblusers', 'user_id')];
    }

    public static function userIdOptional(): array
    {
        return ['sometimes', 'integer', Rule::exists('tblusers', 'user_id')];
    }

    public static function operationRequired(): array
    {
        return ['required', 'string'];
    }

    public static function operationOptional(): array
    {
        return ['sometimes', 'string'];
    }

    public static function statesOptional(): array
    {
        return ['nullable', 'string', 'max:255'];
    }
}
