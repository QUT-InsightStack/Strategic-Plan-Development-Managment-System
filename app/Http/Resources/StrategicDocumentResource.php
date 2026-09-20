<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StrategicDocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'document_id' => $this->document_id,
            'original_filename' => $this->original_filename,
            'mime_type' => $this->mime_type,
            'extension' => $this->extension,
            'size_bytes' => $this->size_bytes,
            'uploaded_by' => $this->uploaded_by,
            'created_at' => $this->created_at,
            'download_url' => url('api/strategic-documents/'.$this->document_id.'/download'),
        ];
    }
}