<?php

namespace App\Http\Requests;

use App\Validation\FoundationValidationRules;

class StoreFoundationsRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_foundations.create'];
    }

    public function rules(): array
    {
        return [
            'created_by' => FoundationValidationRules::createdByRequired(),
            'updated_by' => FoundationValidationRules::updatedByOptional(),
            'type'       => FoundationValidationRules::typeRequired(),
            'content'    => FoundationValidationRules::contentRequired(),
            'version'    => FoundationValidationRules::versionRequired(),
        ];
    }
}
