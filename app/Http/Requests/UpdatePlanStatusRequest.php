<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdatePlanStatusRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_records.archive'];
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', Rule::in(['finished', 'archived'])],
        ];
    }
}
