<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class SearchLogsRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['logs.view'];
    }

    protected function prepareForValidation(): void
    {
        $search = $this->query('search');

        $this->merge([
            'search' => is_string($search)
                ? trim($search)
                : $search,
        ]);
    }

    public function rules(): array
    {
        return [
            'search' => [
                'nullable',
                'string',
                'min:1',
                'max:100',
            ],
            'user_id' => [
                'sometimes',
                'integer',
                Rule::exists('tblusers', 'user_id'),
            ],
            'action' => [
                'sometimes',
                'string',
                'max:150',
            ],
            'resource_type' => [
                'sometimes',
                'string',
                'max:100',
            ],
            'resource_id' => [
                'sometimes',
                'integer',
                'min:1',
            ],
            'outcome' => [
                'sometimes',
                'string',
                Rule::in([
                    'success',
                    'failure',
                    'denied',
                ]),
            ],
            'date_from' => [
                'sometimes',
                'date_format:Y-m-d',
            ],
            'date_to' => [
                'sometimes',
                'date_format:Y-m-d',
                'after_or_equal:date_from',
            ],
            'sort_by' => [
                'sometimes',
                'string',
                Rule::in([
                    'created_at',
                    'action',
                    'user',
                    'resource_type',
                    'outcome',
                ]),
            ],
            'sort_direction' => [
                'sometimes',
                'string',
                Rule::in(['asc', 'desc']),
            ],
            'per_page' => [
                'sometimes',
                'integer',
                'min:1',
                'max:100',
            ],
            'page' => [
                'sometimes',
                'integer',
                'min:1',
            ],
        ];
    }

    public function attributes(): array
    {
        return [
            'search' => 'search value',
            'user_id' => 'user',
            'action' => 'action',
            'resource_type' => 'resource type',
            'resource_id' => 'resource ID',
            'outcome' => 'outcome',
            'date_from' => 'start date',
            'date_to' => 'end date',
            'sort_by' => 'sorting field',
            'sort_direction' => 'sorting direction',
            'per_page' => 'page size',
        ];
    }
}