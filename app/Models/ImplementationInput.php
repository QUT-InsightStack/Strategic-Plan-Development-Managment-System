<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImplementationInput extends Model
{
    public const TYPES = ['progress_update', 'issue', 'change_request'];

    public const PENDING_REVIEW = 'Pending Review';

    public const STATUSES = [self::PENDING_REVIEW, 'Approved', 'Rejected'];

    protected $table = 'tblimplementation_inputs';

    protected $primaryKey = 'input_id';

    public $timestamps = false;

    protected $fillable = ['strategic_plan_id', 'objective_id', 'responsible_unit_id',
        'submitted_by', 'responsible_office_agency', 'submitter_name', 'input_type',
        'content', 'review_status', 'submitted_at'];

    protected $attributes = ['review_status' => self::PENDING_REVIEW];

    protected function casts(): array
    {
        return ['submitted_at' => 'immutable_datetime', 'reviewed_at' => 'immutable_datetime'];
    }

    public function strategicPlan(): BelongsTo
    {
        return $this->belongsTo(Strategic::class, 'strategic_plan_id');
    }

    public function objective(): BelongsTo
    {
        return $this->belongsTo(StrategicObjective::class, 'objective_id');
    }

    public function submittingUnit(): BelongsTo
    {
        return $this->belongsTo(ResponsibleUnit::class, 'responsible_unit_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }
}
