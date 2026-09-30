<?php

namespace App\Http\Requests;

use App\Models\ImplementationInput;
use App\Services\ImplementationInputAccessService;
use Illuminate\Validation\Rule;

class ListImplementationInputsRequest extends ListObjectiveFeedbackRequest
{
    public function authorize(): bool
    {
        app(ImplementationInputAccessService::class)->ensureCanView($this->user('api'));

        return true;
    }

    public function rules(): array
    {
        return [...parent::rules(),
            'plan_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'objective_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'responsible_unit_id' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'input_type' => ['sometimes', 'nullable', Rule::in(ImplementationInput::TYPES)],
            'status' => ['sometimes', 'nullable', Rule::in(ImplementationInput::STATUSES)],
            'submitted_from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'submitted_to' => ['sometimes', 'nullable', 'date_format:Y-m-d', ...($this->filled('submitted_from') ? ['after_or_equal:submitted_from'] : [])],
        ];
    }
}
