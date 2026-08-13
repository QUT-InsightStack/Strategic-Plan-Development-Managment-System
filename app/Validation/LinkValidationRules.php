<?php

namespace App\Validation;

use Illuminate\Validation\Rule;

class LinkValidationRules
{
    public static function coreValueIdRequired(mixed $planId): array
    {
        return [
            'required',
            'integer',
            Rule::exists('tblstrategic_foundations', 'foundation_id')->where('type', 'CORE_VALUE'),
            Rule::unique('tblplan_core_value')->where('plan_id', $planId),
        ];
    }

    public static function coreValueIdOptional(mixed $planId, mixed $linkId): array
    {
        return [
            'sometimes',
            'integer',
            Rule::exists('tblstrategic_foundations', 'foundation_id')->where('type', 'CORE_VALUE'),
            Rule::unique('tblplan_core_value')->where('plan_id', $planId)->ignore($linkId, 'link_id'),
        ];
    }

    public static function planIdRequired(): array
    {
        return ['required', 'integer', Rule::exists('tblstrategic_record', 'record_id')];
    }

    public static function planIdOptional(): array
    {
        return ['sometimes', 'integer', Rule::exists('tblstrategic_record', 'record_id')];
    }

    public static function createdByRequired(): array
    {
        return ['required', 'integer', Rule::exists('tblusers', 'user_id')];
    }

    public static function createdByOptional(): array
    {
        return ['sometimes', 'integer', Rule::exists('tblusers', 'user_id')];
    }

    public static function updatedByRequired(): array
    {
        return ['required', 'integer', Rule::exists('tblusers', 'user_id')];
    }

    public static function updatedByOptional(): array
    {
        return ['sometimes', 'integer', Rule::exists('tblusers', 'user_id')];
    }
}
