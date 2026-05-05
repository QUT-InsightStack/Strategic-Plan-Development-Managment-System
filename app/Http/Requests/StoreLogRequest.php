<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StoreLogRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'user_id'   => ['required', 'integer', Rule::exists('tblusers', 'user_id')],
            'operation' => ['required', 'string'],
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