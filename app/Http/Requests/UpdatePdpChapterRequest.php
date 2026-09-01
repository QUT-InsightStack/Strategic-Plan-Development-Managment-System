<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdatePdpChapterRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['pdp_chapters.manage'];
    }

    public function rules(): array
    {
        $chapterId = $this->route('chapter')?->chapter_id ?? $this->route('chapter');

        return [
            'chapter_title' => ['required', 'string', 'max:255', Rule::unique('tblpdp_chapters', 'chapter_title')->ignore($chapterId, 'chapter_id')],
            'chapter_description' => ['required', 'string'],
        ];
    }
}
