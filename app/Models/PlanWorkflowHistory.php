<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlanWorkflowHistory extends Model
{
    protected $table = 'plan_workflow_history';

    public $timestamps = false;

    protected $guarded = ['id'];
}
