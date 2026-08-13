<?php

namespace App\Http\Requests;

use App\Validation\FoundationValidationRules;

class UpdateFoundationsRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'created_by' => FoundationValidationRules::createdByOptional(),
            'updated_by' => FoundationValidationRules::updatedByOptional(),
            'type'       => FoundationValidationRules::typeOptional(),
            'content'    => FoundationValidationRules::contentOptional(),
            'version'    => FoundationValidationRules::versionOptional(),
        ];
    }
}
