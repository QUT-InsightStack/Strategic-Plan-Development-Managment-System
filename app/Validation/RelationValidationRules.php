<?php

namespace App\Validation;

use Illuminate\Validation\Rule;

class RelationValidationRules
{
    public static function recordIdRequired(mixed $parentId): array
    {
        return ['required', 'integer', Rule::exists('tblstrategic_record', 'record_id'), Rule::notIn([$parentId])];
    }

    public static function recordIdOptional(mixed $parentId): array
    {
        return ['sometimes', 'integer', Rule::exists('tblstrategic_record', 'record_id'), Rule::notIn([$parentId])];
    }

    public static function parentIdRequired(mixed $recordId): array
    {
        return ['required', 'integer', Rule::exists('tblstrategic_record', 'record_id'), Rule::notIn([$recordId]), Rule::unique('tblrelation_map')->where('record_id', $recordId)];
    }

    public static function parentIdOptional(mixed $recordId, mixed $relationId): array
    {
        return ['sometimes', 'integer', Rule::exists('tblstrategic_record', 'record_id'), Rule::notIn([$recordId]), Rule::unique('tblrelation_map')->where('record_id', $recordId)->ignore($relationId, 'relation_id')];
    }

    public static function createdByRequired(): array
    {
        return ['required', 'integer', Rule::exists('tblusers', 'user_id')];
    }

    public static function createdByOptional(): array
    {
        return ['sometimes', 'integer', Rule::exists('tblusers', 'user_id')];
    }
}
