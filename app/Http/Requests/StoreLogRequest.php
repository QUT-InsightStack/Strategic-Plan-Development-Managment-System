<?php

namespace App\Http\Requests;

use App\Validation\LogValidationRules;
use App\Validation\ValidationAttributes;

class StoreLogRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['logs.view'];
    }

    public function rules(): array
    {
        return [
            'user_id'   => LogValidationRules::userIdRequired(),
            'operation' => LogValidationRules::operationRequired(),
            'states'    => LogValidationRules::statesOptional(),
        ];
    }

    public function attributes(): array
    {
        return ValidationAttributes::all();
    }
}
