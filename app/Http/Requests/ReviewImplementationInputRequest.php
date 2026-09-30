<?php

namespace App\Http\Requests;

use App\Services\ImplementationInputAccessService;
use Illuminate\Validation\Rule;

class ReviewImplementationInputRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return app(ImplementationInputAccessService::class)->canReview($this->user('api'));
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(['Approved', 'Rejected'])],
            'review_note' => ['required_if:status,Rejected', 'nullable', 'string', 'max:5000', 'regex:/\S/u'],
            ...array_fill_keys(['content', 'input_type', 'strategic_plan_id', 'objective_id', 'submitted_by',
                'submitted_at', 'responsible_unit_id', 'responsible_office_agency', 'submitter_name',
                'review_status', 'reviewed_by', 'reviewer_name', 'reviewed_at'], ['missing']),
        ];
    }
}
