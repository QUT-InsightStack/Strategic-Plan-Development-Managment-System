<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StoreFoundationsRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'created_by' => ['required', 'integer', Rule::exists('tblusers', 'user_id')],
            'updated_by' => ['nullable', 'integer', Rule::exists('tblusers', 'user_id')],
            'type'       => ['required', 'string', Rule::in(['MISSION', 'VISION', 'CORE_VALUE'])],
            'content'    => ['required', 'string'],
            'version'    => ['required', 'string', 'max:255'],
        ];
    }
}

