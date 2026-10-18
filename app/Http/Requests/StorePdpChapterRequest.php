<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StorePdpChapterRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['pdp_chapters.manage'];
    }

    public function rules(): array
    {
        return [
            'chapter_title' => ['required', 'string', 'max:255', Rule::unique('tblpdp_chapters', 'chapter_title')],
            'chapter_description' => ['required', 'string'],
        ];
    }
}
