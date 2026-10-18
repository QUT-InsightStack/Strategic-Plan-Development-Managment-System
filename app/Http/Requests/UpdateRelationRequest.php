<?php

namespace App\Http\Requests;

use App\Models\Relation;
use App\Validation\RelationValidationRules;

class UpdateRelationRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['relations.update'];
    }

    public function rules(): array
    {
        $relationId = $this->route('relation');
        $existing   = Relation::find($relationId);

        // Fall back to existing DB values when a field is not being changed
        $recordId = $this->input('record_id', $existing?->record_id);
        $parentId = $this->input('parent_id', $existing?->parent_id);

        return [
            'record_id' => RelationValidationRules::recordIdOptional($parentId),
            'parent_id' => RelationValidationRules::parentIdOptional($recordId, $relationId),
            'created_by' => RelationValidationRules::createdByOptional(),
        ];
    }
}
