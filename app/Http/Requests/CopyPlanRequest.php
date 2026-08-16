<?php

namespace App\Http\Requests;

class CopyPlanRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_records.create', 'strategic_records.manage'];
    }

    public function rules(): array
    {
        return [];
    }
}
