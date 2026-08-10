<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdatePlanStatusRequest extends ApiFormRequest
{
    public function rules(): array
    {
        return [
            'status' => ['required', 'string', Rule::in(['draft', 'finished', 'archived'])],
        ];
    }
}
