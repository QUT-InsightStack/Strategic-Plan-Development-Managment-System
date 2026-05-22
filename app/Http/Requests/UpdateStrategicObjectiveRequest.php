<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdateStrategicObjectiveRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isPublishing = $this->input('status') === 'published';

        return [
            'strategic_plan_id' => [
                'sometimes',
                'integer',
                Rule::exists('tblstrategic_record', 'record_id'),
            ],

            'updated_by' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('tblusers', 'user_id'),
            ],

            'status' => [
                'sometimes',
                'string',
                Rule::in(['draft', 'published']),
            ],

            'objective_title' => [
                $isPublishing ? 'required' : 'sometimes',
                'nullable',
                'string',
                'max:255',
            ],

            'objective_description' => [
                $isPublishing ? 'required' : 'sometimes',
                'nullable',
                'string',
            ],

            'expected_outcome' => [
                $isPublishing ? 'required' : 'sometimes',
                'nullable',
                'string',
            ],

            'indicator' => [
                'sometimes',
                'nullable',
                'string',
            ],

            'target' => [
                $isPublishing ? 'required' : 'sometimes',
                'nullable',
                'string',
                'max:255',
            ],

            'responsible_office_agency' => [
                $isPublishing ? 'required' : 'sometimes',
                'nullable',
                'string',
                'max:255',
            ],
        ];
    }

    public function attributes(): array
    {
        return [
            'strategic_plan_id' => 'strategic plan',
            'objective_title' => 'objective title',
            'objective_description' => 'objective description',
            'expected_outcome' => 'expected outcome/objective',
            'responsible_office_agency' => 'responsible office/agency',
        ];
    }
}