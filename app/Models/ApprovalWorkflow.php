<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApprovalWorkflow extends Model
{
    protected $guarded = ['id'];

    public function stages()
    {
        return $this->hasMany(ApprovalWorkflowStage::class, 'workflow_id')->orderBy('sequence');
    }
}
