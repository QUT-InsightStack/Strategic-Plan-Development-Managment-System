<?php

namespace App\Validation;

use Closure;
use Illuminate\Validation\Rule;

class UserValidationRules
{
    /**
     * Accepted gender codes.
     *
     * Stored as codes so the wording shown on screen can change without
     * a migration. The column was a boolean until it became clear that
     * nothing had ever defined which value meant what.
     *
     * @var list<string>
     */
    public const GENDERS = ['female', 'male', 'non_binary', 'prefer_not_to_say'];

    public static function firstNameRequired(): array
    {
        return ['required', 'string', 'max:255'];
    }

    public static function firstNameOptional(): array
    {
        return ['sometimes', 'string', 'max:255'];
    }

    public static function lastNameOptional(): array
    {
        return ['sometimes', 'nullable', 'string', 'max:255'];
    }

    public static function emailForCreate(): array
    {
        return [
            'required',
            'string',
            'email',
            'max:255',
            Rule::unique('tblusers', 'email'),
        ];
    }

    public static function emailForUpdate(mixed $userId): array
    {
        return [
            'sometimes',
            'string',
            'email',
            'max:255',
            Rule::unique('tblusers', 'email')->ignore($userId, 'user_id'),
        ];
    }

    public static function passwordRequired(): array
    {
        return array_merge(
            ['required'],
            self::passwordOptional()
        );
    }

    public static function passwordOptional(): array
    {
        return [
            'sometimes',
            'string',
            'min:8',
            'max:128',
            self::passwordComplexityRule(),
        ];
    }

    public static function passwordComplexityRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $categories = [
                preg_match('/[a-z]/', (string) $value),
                preg_match('/[A-Z]/', (string) $value),
                preg_match('/\d/', (string) $value),
                preg_match('/[^a-zA-Z\d]/', (string) $value),
            ];

            if (array_sum($categories) < 3) {
                $fail('The password must include at least three of the following: lowercase letters, uppercase letters, numbers, and special characters.');
            }
        };
    }

    public static function mobileOptional(): array
    {
        return ['sometimes', 'nullable', 'string', 'max:20'];
    }

    public static function addressOptional(): array
    {
        return ['sometimes', 'nullable', 'string', 'max:255'];
    }

    public static function genderOptional(): array
    {
        return ['sometimes', 'nullable', 'string', Rule::in(self::GENDERS)];
    }

    public static function dateOfBirthOptional(): array
    {
        return ['sometimes', 'nullable', 'date', 'before:today'];
    }

    public static function profilePictureOptional(): array
    {
        return ['sometimes', 'nullable', 'string', 'max:255'];
    }

    public static function departmentOptional(): array
    {
        return ['sometimes', 'nullable', 'string', 'max:255'];
    }

    public static function unitOptional(): array
    {
        return ['sometimes', 'nullable', 'string', 'max:255'];
    }

    public static function officeOptional(): array
    {
        return ['sometimes', 'nullable', 'string', 'max:255'];
    }

    public static function positionOptional(): array
    {
        return ['sometimes', 'nullable', 'string', 'max:255'];
    }

    public static function roleIdOptional(): array
    {
        return [
            'sometimes',
            'nullable',
            'integer',
            Rule::exists('tblroles', 'role_id'),
        ];
    }

    public static function statusOptional(): array
    {
        return ['sometimes', 'string', Rule::in(['active', 'inactive', 'suspended'])];
    }
}
