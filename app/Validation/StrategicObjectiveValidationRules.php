<?php

namespace App\Validation;

use Illuminate\Validation\Rule;

class StrategicObjectiveValidationRules
{
    public static function strategicPlanIdRequired(): array
    {
        return ['required', 'integer', Rule::exists('tblstrategic_record', 'record_id')];
    }

    public static function strategicPlanIdOptional(): array
    {
        return ['sometimes', 'integer', Rule::exists('tblstrategic_record', 'record_id')];
    }

    public static function createdByRequired(): array
    {
        return ['required', 'integer', Rule::exists('tblusers', 'user_id')];
    }

    public static function updatedByOptional(): array
    {
        return ['sometimes', 'nullable', 'integer', Rule::exists('tblusers', 'user_id')];
    }

    public static function statusOptional(): array
    {
        return ['sometimes', 'string', Rule::in(['draft', 'published'])];
    }

    public static function objectiveTitle(bool $required): array
    {
        return [$required ? 'required' : 'sometimes', 'nullable', 'string', 'max:255'];
    }

    public static function objectiveDescription(bool $required): array
    {
        return [$required ? 'required' : 'sometimes', 'nullable', 'string'];
    }

    public static function expectedOutcome(bool $required): array
    {
        return [$required ? 'required' : 'sometimes', 'nullable', 'string'];
    }

    public static function indicatorOptional(): array
    {
        return ['sometimes', 'nullable', 'string'];
    }

    public static function target(bool $required): array
    {
        return [$required ? 'required' : 'sometimes', 'nullable', 'string', 'max:255'];
    }

    public static function responsibleOfficeAgency(bool $required): array
    {
        return [$required ? 'required' : 'sometimes', 'nullable', 'string', 'max:255'];
    }
}
