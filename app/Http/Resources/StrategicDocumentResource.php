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
            'strategic_plan_id' => $this->strategic_plan_id,
            'plan' => $this->whenLoaded('plan', function () {
    return $this->plan ? [
        'record_id' => $this->plan->record_id,
        'title' => $this->plan->title,
    ] : null;
}),
            'original_filename' => $this->original_filename,
            'mime_type' => $this->mime_type,
            'extension' => $this->extension,
            'size_bytes' => $this->size_bytes,
            'reference_level' => $this->reference_level,
            'content_category' => $this->content_category,
            'uploaded_by' => $this->uploaded_by,
            'uploader' => $this->whenLoaded('uploader', function () {
    if (! $this->uploader) {
        return null;
    }

    return [
        'name' => trim(
            ($this->uploader->first_name ?? '').' '.
            ($this->uploader->last_name ?? '')
        ),
        'office' => $this->uploader->office,
    ];
}),
            'created_at' => $this->created_at,
            'download_url' => url('api/strategic-documents/'.$this->document_id.'/download'),
        ];
    }
}
