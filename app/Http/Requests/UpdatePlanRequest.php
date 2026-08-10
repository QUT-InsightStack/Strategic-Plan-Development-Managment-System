<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdatePlanRequest extends CreatePlanRequest
{
    public function rules(): array
    {
        $rules = parent::rules();
        $rules['status'] = ['nullable', 'string', Rule::in(['draft', 'finished', 'archived'])];

        return $rules;
    }
}
