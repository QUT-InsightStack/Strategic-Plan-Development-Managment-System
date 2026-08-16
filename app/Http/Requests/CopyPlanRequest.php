<?php

namespace App\Http\Requests;

class CopyPlanRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_records.create'];
    }

    public function rules(): array
    {
        return [];
    }
}
