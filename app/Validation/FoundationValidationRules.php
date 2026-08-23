<?php

namespace App\Validation;

use Illuminate\Validation\Rule;

class FoundationValidationRules
{
    public static function createdByRequired(): array
    {
        return ['required', 'integer', Rule::exists('tblusers', 'user_id')];
    }

    public static function createdByOptional(): array
    {
        return ['sometimes', 'integer', Rule::exists('tblusers', 'user_id')];
    }

    public static function updatedByOptional(): array
    {
        return ['nullable', 'integer', Rule::exists('tblusers', 'user_id')];
    }

    public static function typeRequired(): array
    {
        return ['required', 'string', Rule::in(['MISSION', 'VISION', 'CORE_VALUE'])];
    }

    public static function typeOptional(): array
    {
        return ['sometimes', 'string', Rule::in(['MISSION', 'VISION', 'CORE_VALUE'])];
    }

    public static function contentRequired(): array
    {
        return ['required', 'string'];
    }

    public static function contentOptional(): array
    {
        return ['sometimes', 'string'];
    }

    public static function versionRequired(): array
    {
        return ['required', 'string', 'max:255'];
    }

    public static function versionOptional(): array
    {
        return ['sometimes', 'string', 'max:255'];
    }
}
