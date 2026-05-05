<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StoreLinkRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $planId = $this->input('plan_id');

        return [
            'core_value_id' => [
                'required',
                'integer',
                Rule::exists('tblstrategic_foundations', 'foundation_id')
                    ->where('type', 'CORE_VALUE'),
                Rule::unique('tblplan_core_value')->where('plan_id', $planId),
            ],
            'plan_id'    => ['required', 'integer', Rule::exists('tblstrategic_record', 'record_id')],
            'created_by' => ['required', 'integer', Rule::exists('tblusers', 'user_id')],
            'updated_by' => ['required', 'integer', Rule::exists('tblusers', 'user_id')],
        ];
    }
}