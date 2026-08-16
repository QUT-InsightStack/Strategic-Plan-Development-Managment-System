<?php

namespace App\Http\Requests;

use App\Validation\LinkValidationRules;

class StoreLinkRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['plan_core_values.manage'];
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
