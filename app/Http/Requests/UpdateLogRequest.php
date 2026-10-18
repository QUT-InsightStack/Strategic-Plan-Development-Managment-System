<?php

namespace App\Http\Requests;

use App\Validation\LogValidationRules;
use App\Validation\ValidationAttributes;

class UpdateLogRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['logs.update'];
    }

    public function rules(): array
    {
        return [
            'user_id'   => LogValidationRules::userIdOptional(),
            'operation' => LogValidationRules::operationOptional(),
            'states'    => LogValidationRules::statesOptional(),
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
