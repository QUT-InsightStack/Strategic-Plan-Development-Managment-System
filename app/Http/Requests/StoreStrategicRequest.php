<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StoreStrategicRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'created_by'   => ['required', 'integer', Rule::exists('tblusers', 'user_id')],
            'updated_by'   => ['nullable', 'integer', Rule::exists('tblusers', 'user_id')],
            'level'        => ['required', 'string', 'max:255'],
            'title'        => ['required', 'string', 'max:255'],
            'description'  => ['sometimes', 'nullable', 'string'],
            'file_path'    => ['sometimes', 'nullable', 'string', 'max:255'],
            'mission_id'   => ['required', 'integer', Rule::exists('tblstrategic_foundations', 'foundation_id')],
            'vision_id'    => ['required', 'integer', Rule::exists('tblstrategic_foundations', 'foundation_id')],
            'parent_ids'   => ['sometimes', 'array'],
            'parent_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('tblstrategic_record', 'record_id'),
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