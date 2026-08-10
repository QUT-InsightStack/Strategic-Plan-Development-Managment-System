<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StoreStrategicObjectiveRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $isDraft = $this->input('status') === 'draft';

        return [
            'strategic_plan_id' => [
                'required',
                'integer',
                Rule::exists('tblstrategic_record', 'record_id'),
            ],

            'status' => [
                'sometimes',
                'string',
                Rule::in(['draft', 'published']),
            ],

            'objective_title' => [
                $isDraft ? 'sometimes' : 'required',
                'nullable',
                'string',
                'max:255',
            ],

            'objective_description' => [
                $isDraft ? 'sometimes' : 'required',
                'nullable',
                'string',
            ],

            'expected_outcome' => [
                $isDraft ? 'sometimes' : 'required',
                'nullable',
                'string',
            ],

            'indicator' => [
                'sometimes',
                'nullable',
                'string',
            ],

            'target' => [
                $isDraft ? 'sometimes' : 'required',
                'nullable',
                'string',
                'max:255',
            ],

            'responsible_office_agency' => [
                $isDraft ? 'sometimes' : 'required',
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
