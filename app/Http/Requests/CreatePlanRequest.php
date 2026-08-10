<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class CreatePlanRequest extends ApiFormRequest
{
    public function rules(): array
    {
        $isDraft = $this->input('status') === 'draft';

        return [
            'title' => [$isDraft ? 'nullable' : 'required', 'string', 'max:255'],
            'level' => ['required', 'string', Rule::in(['strategic_plan', 'goal'])],
            'description' => ['nullable', 'string'],
            'mission' => [$isDraft ? 'nullable' : 'required', 'string'],
            'vision' => [$isDraft ? 'nullable' : 'required', 'string'],
            'core_values' => $isDraft ? ['sometimes', 'array'] : ['required', 'array', 'min:1'],
            'core_values.*' => ['required', 'string', 'max:255', 'distinct'],

            // Reserved API contract. These values can be sent by the page now,
            // but are not persisted until the matching database columns exist.
            'planning_start_date' => ['nullable', 'date'],
            'planning_end_date' => ['nullable', 'date', 'after_or_equal:planning_start_date'],
            'department_agency' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', Rule::in(['draft', 'finished', 'archived'])],
        ];
    }
}
