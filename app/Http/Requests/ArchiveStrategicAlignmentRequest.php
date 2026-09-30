<?php

namespace App\Http\Requests;

class ArchiveStrategicAlignmentRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_alignments.archive'];
    }

    /**
     * The mapping is identified by the route. Lifecycle and actor values are
     * server-assigned and cannot be supplied by the client.
     */
    public function rules(): array
    {
        return [
            'objective_id' => ['prohibited'],
            'chapter_id' => ['prohibited'],
            'agenda_id' => ['prohibited'],
            'status' => ['prohibited'],
            'archived_at' => ['prohibited'],
            'archived_by' => ['prohibited'],
        ];
    }
}