<?php

namespace App\Http\Requests;

class UpdateStrategicObjectiveAlignmentRequest extends StoreStrategicObjectiveAlignmentRequest
{
    public function rules(): array
    {
        return [
            'objective_id' => ['prohibited'],
            'strategic_plan_id' => ['prohibited'],
            'created_by' => ['prohibited'],
            'updated_by' => ['prohibited'],
            'pdp_chapter_ids' => [$this->has('presidential_agenda_item_ids') ? 'sometimes' : 'present', 'array', 'list', 'max:100'],
            'pdp_chapter_ids.*' => ['bail', 'required', 'integer:strict', 'min:1', 'distinct'],
            'presidential_agenda_item_ids' => [$this->has('pdp_chapter_ids') ? 'sometimes' : 'present', 'array', 'list', 'max:100'],
            'presidential_agenda_item_ids.*' => ['bail', 'required', 'integer:strict', 'min:1', 'distinct'],
        ];
    }
}
