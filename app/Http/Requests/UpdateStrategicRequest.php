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
        $recordId = $this->route('strategic_record');

        return [
            'created_by'   => ['sometimes', 'integer', Rule::exists('tblusers', 'user_id')],
            'updated_by'   => ['nullable', 'integer', Rule::exists('tblusers', 'user_id')],
            'level' => ['sometimes','string',Rule::in(['strategic_plan', 'goal']),],
            'title'        => ['sometimes', 'string', 'max:255'],
            'description'  => ['sometimes', 'nullable', 'string'],
            'file_path'    => ['sometimes', 'nullable', 'string', 'max:255'],
            'mission_id'   => [
                'sometimes',
                'integer',
                Rule::exists('tblstrategic_foundations', 'foundation_id')
                    ->where('type', 'MISSION'),         // ← only accepts MISSION type
            ],
            'vision_id'    => [
                'sometimes',
                'integer',
                Rule::exists('tblstrategic_foundations', 'foundation_id')
                    ->where('type', 'VISION'),          // ← only accepts VISION type
            ],
            'parent_ids'   => ['sometimes', 'array'],
            'parent_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('tblstrategic_record', 'record_id'),
                Rule::notIn([$recordId]),
            ],
        ];
    }

    public function attributes(): array
    {
        return [
            'mission_id' => 'mission',
            'vision_id'  => 'vision',
            'file_path'  => 'file',
        ];
    }
}
