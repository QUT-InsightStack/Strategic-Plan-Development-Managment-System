<?php

namespace App\Http\Requests;

class UpdateObjectiveProgressRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['strategic_objectives.update_progress', 'strategic_objectives.correct_progress'];
    }

    public function rules(): array
    {
        return [
            'progress_percentage' => ['required', 'integer:strict', 'between:0,100'],
            'reason' => ['nullable', 'string', 'max:5000'],
            ...array_fill_keys([
                'status', 'progress_status', 'objective_id', 'strategic_plan_id',
                'responsible_unit_id', 'responsible_office_agency', 'updated_by',
                'progress_updated_by', 'progress_updated_at', 'created_by',
                'objective_title', 'objective_description', 'expected_outcome', 'indicator', 'target',
            ], ['missing']),
        ];
    }
}
