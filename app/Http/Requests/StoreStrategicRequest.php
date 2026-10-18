<?php

namespace App\Http\Requests;

use App\Validation\StrategicValidationRules;
use App\Validation\ValidationAttributes;

class StoreStrategicRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_records.create'];
    }

    public function rules(): array
    {
        return [
            'created_by' => StrategicValidationRules::createdByRequired(),
            'updated_by' => StrategicValidationRules::updatedByOptional(),
            'level' => StrategicValidationRules::levelRequired(),
            'title' => StrategicValidationRules::titleRequired(),
            'description' => StrategicValidationRules::descriptionOptional(),
            'file_path' => StrategicValidationRules::filePathOptional(),
            'mission_id' => StrategicValidationRules::missionIdRequired(),
            'vision_id' => StrategicValidationRules::visionIdRequired(),
            'parent_ids' => StrategicValidationRules::parentIdsOptional(),
            'parent_ids.*' => StrategicValidationRules::parentIdItem(),
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
