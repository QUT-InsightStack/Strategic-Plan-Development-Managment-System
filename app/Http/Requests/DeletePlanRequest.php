<?php

namespace App\Http\Requests;

class DeletePlanRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_records.delete', 'strategic_records.manage'];
    }

    public function rules(): array
    {
        return [];
    }
}
