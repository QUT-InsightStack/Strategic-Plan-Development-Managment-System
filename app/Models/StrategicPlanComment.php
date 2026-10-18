<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StrategicPlanComment extends Model
{
    protected $table = 'tblstrategic_plan_comments';
    protected $primaryKey = 'plan_comment_id';
    public $timestamps = false;

    protected $fillable = [
        'strategic_plan_id', 'responsible_unit_id', 'submitted_by',
        'responsible_office_agency', 'submitter_name', 'content', 'submitted_at',
    ];

    protected function casts(): array
    {
        return ['submitted_at' => 'datetime'];
    }
}
