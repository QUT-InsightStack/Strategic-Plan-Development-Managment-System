<?php

namespace App\Http\Requests;

abstract class StoreObjectiveFeedbackRequest extends ApiFormRequest
{
    protected function feedbackRules(): array
    {
        return [
            'content' => ['required', 'string', 'max:10000', 'regex:/\S/u'],
            'objective_id' => ['missing'],
            'strategic_plan_id' => ['missing'],
            'responsible_unit_id' => ['missing'],
            'responsible_office_agency' => ['missing'],
            'submitted_by' => ['missing'],
            'submitter_name' => ['missing'],
            'submitted_at' => ['missing'],
            'review_status' => ['missing'],
            'status' => ['missing'],
        ];
    }
}
