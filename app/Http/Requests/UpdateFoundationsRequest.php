<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdateFoundationsRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'created_by' => ['sometimes', 'integer', Rule::exists('tblusers', 'user_id')],
            'updated_by' => ['nullable', 'integer', Rule::exists('tblusers', 'user_id')],
            'type'       => ['sometimes', 'string', Rule::in(['MISSION', 'VISION', 'CORE_VALUE'])],
            'content'    => ['sometimes', 'string'],
            'version'    => ['sometimes', 'string', 'max:255'],
        ];
    }
}