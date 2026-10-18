<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlanSubmissionStage extends Model
{
    public $timestamps = false;

    protected $guarded = ['id'];

    public function reviewers()
    {
        return $this->belongsToMany(User::class, 'plan_stage_reviewers', 'stage_id', 'user_id')
            ->select('tblusers.user_id', 'tblusers.first_name', 'tblusers.last_name')
            ->withPivot('reviewer_name');
    }
}
