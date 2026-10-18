<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdatePdpChapterStatusRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['pdp_chapters.archive'];
    }

    public function rules(): array
    {
        return [
            'status' => [
                'required',
                'string',
                Rule::in(['archived', 'active']),
            ],
        ];
    }

    public function attributes(): array
    {
        return [
            'status' => 'chapter status action',
        ];
    }
}