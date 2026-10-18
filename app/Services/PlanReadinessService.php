<?php

namespace App\Services;

use App\Models\ImplementationInput;
use App\Models\Strategic;

class PlanReadinessService
{
    public function errors(Strategic $plan): array
    {
        $plan->loadMissing(['missionFoundation', 'visionFoundation', 'coreValues', 'objectives', 'inputs']);
        $objectives = $plan->objectives->whereNotIn('status', ['archived', 'deleted']);
        $errors = [];
        if ($plan->level !== 'strategic_plan' || ! in_array($plan->status, ['draft', 'finished'], true)) {
            $errors['plan'] = 'An active strategic plan is required.';
        }
        if (! trim($plan->title ?? '') || $plan->title === 'Untitled Strategic Plan') {
            $errors['title'] = 'Enter a plan title.';
        }
        if (! $plan->planning_start_date || ! $plan->planning_end_date) {
            $errors['period'] = 'Complete the planning period.';
        }
        if (! trim($plan->missionFoundation?->content ?? '') || ! trim($plan->visionFoundation?->content ?? '') || $plan->coreValues->isEmpty()) {
            $errors['foundations'] = 'Complete the mission, vision and core values.';
        }
        if ($objectives->isEmpty() || $objectives->contains(function ($objective) {
            foreach (['objective_title', 'expected_outcome', 'indicator', 'target', 'responsible_office_agency'] as $field) {
                if (trim((string) $objective->{$field}) === '') return true;
            }
            return false;
        })) {
            $errors['objectives'] = 'Complete each objective title, expected outcome, indicator, target and responsible Office / Agency.';
        }
        if ($plan->inputs->contains('review_status', ImplementationInput::PENDING_REVIEW)) {
            $errors['inputs'] = 'Review all pending inputs before submitting.';
        }
        return $errors;
    }

    public function describe(Strategic $plan): Strategic
    {
        $errors = $this->errors($plan);
        // These relations support preparation checks, not the plan-list payload.
        $plan->unsetRelation('objectives');
        $plan->unsetRelation('inputs');
        $approval = $plan->approval_status ?? 'not_submitted';
        $ready = $plan->status === 'finished' && ! $errors;
        $label = match (true) {
            $plan->status === 'archived' => 'Archived',
            $plan->status === 'deleted' => 'Deleted',
            $approval === 'under_approval' => 'Awaiting Approval',
            $approval === 'approved' => 'Approved',
            $approval === 'rejected' => 'Returned for Correction',
            $ready => 'Ready to Submit',
            $plan->status === 'finished' => 'Finalized — Needs Completion',
            default => 'Draft',
        };
        $plan->setAttribute('planning_status_label', $label);
        $plan->setAttribute('ready_to_submit', $ready && $approval === 'not_submitted');
        $plan->setAttribute('review_ready', $plan->status === 'finished' && ($ready || in_array($approval, ['under_approval', 'approved', 'rejected'], true)));
        $plan->setAttribute('preparation_errors', $errors);
        return $plan;
    }
}
