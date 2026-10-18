<?php

namespace App\Http\Requests;

use App\Validation\StrategicObjectiveValidationRules;
use App\Validation\ValidationAttributes;

class UpdateStrategicObjectiveRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_objectives.update'];
    }

    public function rules(): array
    {
        $isPublishing = $this->input('status') === 'published';

        return [
            'progress_percentage' => ['missing'],
            'progress_status' => ['missing'],
            'progress_updated_at' => ['missing'],
            'progress_updated_by' => ['missing'],
            'strategic_plan_id' => ['prohibited'],
            'created_by' => ['prohibited'],
            'updated_by' => ['prohibited'],
            'archived_at' => ['prohibited'],
            'archived_by' => ['prohibited'],
            'deleted_at' => ['prohibited'],
            'status_before_archive' => ['prohibited'],
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
