<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdateStrategicObjectiveStatusRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_objectives.archive'];
    }

    public function rules(): array
    {
        return [
            'status' => [
                'required',
                'string',
                Rule::in(['archived', 'restored']),
            ],
        ];
    }

    public function attributes(): array
    {
        return [
            'status' => 'objective status action',
        ];
    }
}