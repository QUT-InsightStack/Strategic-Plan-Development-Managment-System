<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdateStrategicRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Route::apiResource('strategic-records', ...) → parameter name: {strategic_record}
        $recordId = $this->route('strategic_record');

        return [
            'created_by'   => ['sometimes', 'integer', Rule::exists('tblusers', 'user_id')],
            'updated_by'   => ['nullable', 'integer', Rule::exists('tblusers', 'user_id')],
            'level'        => ['sometimes', 'string', 'max:255'],
            'title'        => ['sometimes', 'string', 'max:255'],
            'description'  => ['nullable', 'string'],
            'file_path'    => ['nullable', 'string', 'max:255'],
            'mission_id'   => ['sometimes', 'integer', Rule::exists('tblstrategic_foundations', 'foundation_id')],
            'vision_id'    => ['sometimes', 'integer', Rule::exists('tblstrategic_foundations', 'foundation_id')],
            'parent_ids'   => ['sometimes', 'array'],
            'parent_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('tblstrategic_record', 'record_id'),
                Rule::notIn([$recordId]),   // prevent self-reference
            ],
        ];
    }
}
