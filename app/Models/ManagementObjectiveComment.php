<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ManagementObjectiveComment extends Model
{
    protected $table = 'tblmanagement_objective_comments';

    protected $primaryKey = 'comment_id';

    protected $fillable = [
        'strategic_plan_id',
        'objective_id',
        'author_id',
        'author_name',
        'content',
        'acknowledgement_status',
        'acknowledged_by',
        'acknowledger_name',
        'acknowledged_at',
        'completion_status',
        'closing_remarks',
        'closed_by',
        'closer_name',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'acknowledged_at' => 'immutable_datetime',
            'closed_at' => 'immutable_datetime',
        ];
    }

    public function objective(): BelongsTo
    {
        return $this->belongsTo(
            StrategicObjective::class,
            'objective_id',
            'objective_id'
        );
    }

    public function strategicPlan(): BelongsTo
    {
        return $this->belongsTo(
            Strategic::class,
            'strategic_plan_id',
            'record_id'
        );
    }
}