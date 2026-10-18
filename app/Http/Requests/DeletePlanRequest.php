<?php

namespace App\Http\Requests;

class DeletePlanRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_records.delete'];
    }

    public function rules(): array
    {
        return [];
    }
}
