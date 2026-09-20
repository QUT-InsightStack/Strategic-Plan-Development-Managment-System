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
                'required', 'file', 'max:10240',
                'mimes:pdf,doc,docx,xls,xlsx',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'document.required' => 'Choose a document to upload.',
            'document.file' => 'The uploaded item must be a file.',
            'document.mimes' => 'Use a PDF, Word or Excel document.',
            'document.max' => 'The document must be 10 MB or smaller.',
        ];
    }
}