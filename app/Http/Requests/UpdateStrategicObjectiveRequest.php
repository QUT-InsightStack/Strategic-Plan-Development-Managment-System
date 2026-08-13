<?php

namespace App\Http\Requests;

use App\Validation\StrategicObjectiveValidationRules;
use App\Validation\ValidationAttributes;

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
            'strategic_plan_id' => StrategicObjectiveValidationRules::strategicPlanIdOptional(),
            'updated_by' => StrategicObjectiveValidationRules::updatedByOptional(),
            'status' => StrategicObjectiveValidationRules::statusOptional(),
            'objective_title' => StrategicObjectiveValidationRules::objectiveTitle($isPublishing),
            'objective_description' => StrategicObjectiveValidationRules::objectiveDescription($isPublishing),
            'expected_outcome' => StrategicObjectiveValidationRules::expectedOutcome($isPublishing),
            'indicator' => StrategicObjectiveValidationRules::indicatorOptional(),
            'target' => StrategicObjectiveValidationRules::target($isPublishing),
            'responsible_office_agency' => StrategicObjectiveValidationRules::responsibleOfficeAgency($isPublishing),
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
