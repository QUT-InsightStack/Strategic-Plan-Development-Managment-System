<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlanSubmission extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['plan_snapshot' => 'array', 'workflow_snapshot' => 'array',
            'submitted_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function stages()
    {
        return $this->hasMany(PlanSubmissionStage::class, 'submission_id')->orderBy('sequence');
    }

    public function history()
    {
        return $this->hasMany(PlanWorkflowHistory::class, 'submission_id')->orderBy('id');
    }
}
