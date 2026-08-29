<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class SearchLoginHistoryRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['login_history.view'];
    }

    protected function prepareForValidation(): void
    {
        $data = [];

        foreach ([
            'search',
            'email',
            'ip_address',
            'date_from',
            'date_to',
            'sort_by',
            'sort_direction',
            'status',
        ] as $field) {
            $value = $this->query($field);

            
            if (is_string($value)) {
                $value = trim($value);

                if ($value === '') {
                    $value = null;
                }
            }

            $data[$field] = $value;
        }

        $userId = $this->query('user_id');
        $perPage = $this->query('per_page');
        $page = $this->query('page');

        $data['user_id'] = $this->normalizeOptionalScalar($userId);
        $data['per_page'] = $this->normalizeOptionalScalar($perPage);
        $data['page'] = $this->normalizeOptionalScalar($page);

        if (is_string($data['email'])) {
            $data['email'] = mb_strtolower($data['email']);
        }

        $this->merge($data);
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
                'nullable',
                'integer',
                Rule::exists('tblusers', 'user_id'),
            ],

            'email' => [
                'nullable',
                'string',
                'email',
                'max:255',
            ],

            'status' => [
                'nullable',
                'string',
                Rule::in([
                    'success',
                    'failed',
                ]),
            ],

            'ip_address' => [
                'nullable',
                'string',
                'ip',
                'max:45',
            ],

            'date_from' => [
                'nullable',
                'date_format:Y-m-d',
            ],

            'date_to' => [
                'nullable',
                'date_format:Y-m-d',
                'after_or_equal:date_from',
            ],

            'sort_by' => [
                'nullable',
                'string',
                Rule::in([
                    'attempted_at',
                    'user',
                    'email',
                    'status',
                    'ip_address',
                ]),
            ],

            'sort_direction' => [
                'nullable',
                'string',
                Rule::in([
                    'asc',
                    'desc',
                ]),
            ],

            'per_page' => [
                'nullable',
                'integer',
                'min:1',
                'max:100',
            ],

            'page' => [
                'nullable',
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
            'email' => 'email address',
            'status' => 'login status',
            'ip_address' => 'IP address',
            'date_from' => 'start date',
            'date_to' => 'end date',
            'sort_by' => 'sorting field',
            'sort_direction' => 'sorting direction',
            'per_page' => 'page size',
        ];
    }

    private function normalizeOptionalScalar(mixed $value): mixed
    {
        if (is_string($value)) {
            $value = trim($value);

            return $value === '' ? null : $value;
        }

        return $value;
    }
}