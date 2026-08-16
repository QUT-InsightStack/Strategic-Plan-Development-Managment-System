<?php

namespace App\Http\Requests;

use App\Validation\RelationValidationRules;

class StoreRelationRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['relations.manage'];
    }

    public function rules(): array
    {
        $recordId = $this->input('record_id');
        $parentId = $this->input('parent_id');

        return [
            'record_id' => RelationValidationRules::recordIdRequired($parentId),
            'parent_id' => RelationValidationRules::parentIdRequired($recordId),
            'created_by' => RelationValidationRules::createdByRequired(),
        ];
    }
}
