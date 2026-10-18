<?php

namespace App\Validation;

use Illuminate\Validation\Rule;

class StrategicValidationRules
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

    public static function levelRequired(): array
    {
        return ['required', 'string', Rule::in(['strategic_plan', 'goal'])];
    }

    public static function levelOptional(): array
    {
        return ['sometimes', 'string', Rule::in(['strategic_plan', 'goal'])];
    }

    public static function titleRequired(): array
    {
        return ['required', 'string', 'max:255'];
    }

    public static function titleOptional(): array
    {
        return ['sometimes', 'string', 'max:255'];
    }

    public static function descriptionOptional(): array
    {
        return ['sometimes', 'nullable', 'string'];
    }

    public static function filePathOptional(): array
    {
        return ['sometimes', 'nullable', 'string', 'max:255'];
    }

    public static function missionIdRequired(): array
    {
        return [
            'required',
            'integer',
            Rule::exists('tblstrategic_foundations', 'foundation_id')->where(
                fn ($query) => $query->where('type', 'MISSION')->where('status', '!=', 'deleted')
            ),
        ];
    }

    public static function missionIdOptional(): array
    {
        return [
            'sometimes',
            'integer',
            Rule::exists('tblstrategic_foundations', 'foundation_id')->where(
                fn ($query) => $query->where('type', 'MISSION')->where('status', '!=', 'deleted')
            ),
        ];
    }

    public static function visionIdRequired(): array
    {
        return [
            'required',
            'integer',
            Rule::exists('tblstrategic_foundations', 'foundation_id')->where(
                fn ($query) => $query->where('type', 'VISION')->where('status', '!=', 'deleted')
            ),
        ];
    }

    public static function visionIdOptional(): array
    {
        return [
            'sometimes',
            'integer',
            Rule::exists('tblstrategic_foundations', 'foundation_id')->where(
                fn ($query) => $query->where('type', 'VISION')->where('status', '!=', 'deleted')
            ),
        ];
    }

    public static function parentIdsOptional(): array
    {
        return ['sometimes', 'array'];
    }

    public static function parentIdItem(mixed $recordId = null): array
    {
        $rules = [
            'integer',
            'distinct',
            Rule::exists('tblstrategic_record', 'record_id')->where(
                fn ($query) => $query->where('status', '!=', 'deleted')
            ),
        ];

        if ($recordId !== null) {
            $rules[] = Rule::notIn([$recordId]);
        }

        return $rules;
    }
}
