<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class SystemMonitoringRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['system_monitoring.view'];
    }

    public function rules(): array
    {
        return [
            'minutes' => ['sometimes', 'integer', 'min:1', 'max:1440'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'status_code' => ['sometimes', 'integer', 'min:100', 'max:599'],
            'request_id' => ['sometimes', 'uuid'],
            'slow' => ['sometimes', 'boolean'],
            'severity' => ['sometimes', 'in:info,warning,error,critical'],
            'source' => ['sometimes', 'string', 'max:40', 'regex:/^[a-z_]+$/'],
            'event' => ['sometimes', 'string', 'max:100', 'regex:/^[a-z_.]+$/'],
            'outcome' => ['sometimes', 'in:success,failure,denied'],
            'status' => ['sometimes', 'in:open,resolved'],
            'from' => ['sometimes', 'date'],
            'to' => ['sometimes', 'date', Rule::when($this->filled('from'), 'after_or_equal:from')],
        ];
    }
}
