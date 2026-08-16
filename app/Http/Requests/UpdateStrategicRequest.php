<?php

namespace App\Http\Requests;

use App\Validation\StrategicValidationRules;
use App\Validation\ValidationAttributes;

class UpdateStrategicRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_records.update'];
    }

    public function rules(): array
    {
        $recordId = $this->route('strategic_record');

        return [
            'created_by' => StrategicValidationRules::createdByOptional(),
            'updated_by' => StrategicValidationRules::updatedByOptional(),
            'level' => StrategicValidationRules::levelOptional(),
            'title' => StrategicValidationRules::titleOptional(),
            'description' => StrategicValidationRules::descriptionOptional(),
            'file_path' => StrategicValidationRules::filePathOptional(),
            'mission_id' => StrategicValidationRules::missionIdOptional(),
            'vision_id' => StrategicValidationRules::visionIdOptional(),
            'parent_ids' => StrategicValidationRules::parentIdsOptional(),
            'parent_ids.*' => StrategicValidationRules::parentIdItem($recordId),
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
