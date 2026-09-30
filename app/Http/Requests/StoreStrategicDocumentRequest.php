<?php

namespace App\Http\Requests;

class StoreStrategicDocumentRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_documents.upload'];
    }

    public function rules(): array
    {
        return [
            'document' => [
                'required', 'file', 'max:51200',
                'mimes:pdf,doc,docx,csv,xls,xlsx,mp4,mov',
            ],
            'reference_level' => ['required', 'string', 'in:Agenda,PDP,DOST,Agency'],
            'content_category' => ['required', 'string', 'in:Mission,Vision,Core Values,Strategic Objectives,Supporting Evidence'],
        ];
    }

    public function messages(): array
    {
        return [
            'document.required' => 'Choose a document to upload.',
            'document.file' => 'The uploaded item must be a file.',
            'document.mimes' => 'Use a PDF, Word, CSV, Excel, MP4 or MOV file.',
            'document.max' => 'The file must be 50 MB or smaller.',
            'reference_level.required' => 'Choose a reference level.',
            'content_category.required' => 'Choose a content category.',
        ];
    }
}
