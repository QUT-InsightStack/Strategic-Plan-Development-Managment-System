<?php

namespace App\Http\Requests;

use App\Models\Link;
use App\Validation\LinkValidationRules;

class UpdateLinkRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['plan_core_values.manage'];
    }

    public function rules(): array
    {
        // Route::apiResource('plan-core-values', ...) → parameter name: {plan_core_value}
        $linkId   = $this->route('plan_core_value');
        $existing = Link::find($linkId);

        $planId = $this->input('plan_id', $existing?->plan_id);

        return [
            'core_value_id' => LinkValidationRules::coreValueIdOptional($planId, $linkId),
            'plan_id'    => LinkValidationRules::planIdOptional(),
            'created_by' => LinkValidationRules::createdByOptional(),
            'updated_by' => LinkValidationRules::updatedByOptional(),
        ];
    }
}
