<?php

namespace App\Http\Requests;

use App\Validation\LinkValidationRules;

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
            'core_value_id' => LinkValidationRules::coreValueIdRequired($planId),
            'plan_id'    => LinkValidationRules::planIdRequired(),
            'created_by' => LinkValidationRules::createdByRequired(),
            'updated_by' => LinkValidationRules::updatedByRequired(),
        ];
    }
}
