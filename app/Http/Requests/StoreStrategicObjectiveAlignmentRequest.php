<?php

namespace App\Http\Requests;

use Illuminate\Validation\Validator;

class StoreStrategicObjectiveAlignmentRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_objectives.update'];
    }

    public function rules(): array
    {
        return [
            'objective_id' => ['prohibited'],
            'strategic_plan_id' => ['prohibited'],
            'created_by' => ['prohibited'],
            'updated_by' => ['prohibited'],
            'pdp_chapter_ids' => ['required_without:presidential_agenda_item_ids', 'array', 'list', 'max:100'],
            'pdp_chapter_ids.*' => ['bail', 'required', 'integer:strict', 'min:1', 'distinct'],
            'presidential_agenda_item_ids' => ['required_without:pdp_chapter_ids', 'array', 'list', 'max:100'],
            'presidential_agenda_item_ids.*' => ['bail', 'required', 'integer:strict', 'min:1', 'distinct'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if (! $this->isJson()) {
                return;
            }

            // Associative JSON decoding turns {} and objects with numeric keys
            // into PHP lists. They must not be mistaken for mapping selections.
            $payload = json_decode($this->getContent());
            foreach (['pdp_chapter_ids', 'presidential_agenda_item_ids'] as $field) {
                if (isset($payload->{$field}) && is_object($payload->{$field})) {
                    $validator->errors()->add($field, 'The mapping selection must be a JSON array.');
                }
            }
        }];
    }
}
