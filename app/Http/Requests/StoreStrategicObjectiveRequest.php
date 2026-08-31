<?php

namespace App\Http\Requests;

use App\Validation\StrategicObjectiveValidationRules;
use App\Validation\ValidationAttributes;

class StoreStrategicObjectiveRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_objectives.create'];
    }

    public function rules(): array
    {
        $isDraft = $this->input('status', 'draft') === 'draft';

        return [
            'strategic_plan_id' => StrategicObjectiveValidationRules::strategicPlanIdRequired(),
            'status' => StrategicObjectiveValidationRules::statusOptional(),
            'objective_title' => StrategicObjectiveValidationRules::objectiveTitle(! $isDraft),
            'objective_description' => StrategicObjectiveValidationRules::objectiveDescription(! $isDraft),
            'expected_outcome' => StrategicObjectiveValidationRules::expectedOutcome(! $isDraft),
            'indicator' => StrategicObjectiveValidationRules::indicatorOptional(),
            'target' => StrategicObjectiveValidationRules::target(! $isDraft),
            'responsible_office_agency' => StrategicObjectiveValidationRules::responsibleOfficeAgency(! $isDraft),
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
