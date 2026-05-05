<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdateLogRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id'   => ['sometimes', 'integer', Rule::exists('tblusers', 'user_id')],
            'operation' => ['sometimes', 'string'],
            'states'    => ['nullable', 'string', 'max:255'],
        ];
    }

    public function attributes(): array
    {
        return [
            'user_id' => 'user',
        ];
    }
}