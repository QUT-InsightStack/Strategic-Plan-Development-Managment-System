<?php

namespace App\Http\Requests;

use Closure;

class DeleteStrategicAlignmentRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_alignments.delete'];
    }

    public function rules(): array
    {
        return [
            'reason' => [
                'required',
                'string',
                'max:1000',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (is_string($value) && trim($value) === '') {
                        $fail('A deletion reason is required.');
                    }
                },
            ],

            // The mapping and actor are determined by the route and JWT.
            'objective_id' => ['prohibited'],
            'chapter_id' => ['prohibited'],
            'agenda_id' => ['prohibited'],
            'status' => ['prohibited'],
            'archived_at' => ['prohibited'],
            'archived_by' => ['prohibited'],
            'deleted_at' => ['prohibited'],
            'deleted_by' => ['prohibited'],
        ];
    }
}