<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class SearchUsersRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $search = $this->query('search');

        $this->merge([
            'search' => is_string($search) ? trim($search) : $search,
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

            'search_by' => [
                'sometimes',
                'string',
                Rule::in(['all', 'name', 'email', 'role']),
            ],

            'role_id' => [
                'sometimes',
                'integer',
                Rule::exists('tblroles', 'role_id'),
            ],

            'status' => [
                'sometimes',
                'string',
                Rule::in(['active', 'inactive', 'suspended']),
            ],

            'unit' => [
                'sometimes',
                'string',
                'max:255',
            ],

            'office' => [
                'sometimes',
                'string',
                'max:255',
            ],

            'department' => [
                'sometimes',
                'string',
                'max:255',
            ],

            'sort_by' => [
                'sometimes',
                'string',
                Rule::in([
                    'name',
                    'email',
                    'role',
                    'status',
                    'created_at',
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
            'search'         => 'search value',
            'search_by'      => 'search field',
            'role_id'        => 'role',
            'sort_by'        => 'sorting field',
            'sort_direction' => 'sorting direction',
            'per_page'       => 'page size',
        ];
    }
}