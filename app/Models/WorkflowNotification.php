<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkflowNotification extends Model
{
    protected $guarded = ['id'];

    protected $attributes = ['status' => 'pending', 'attempts' => 0];

    protected function casts(): array
    {
        return ['payload' => 'array', 'sent_at' => 'datetime', 'read_at' => 'datetime',
            'next_attempt_at' => 'datetime', 'attempts' => 'integer'];
    }

    public function event()
    {
        return $this->belongsTo(PlanWorkflowHistory::class, 'event_id');
    }

    public function recipient()
    {
        return $this->belongsTo(User::class, 'recipient_id', 'user_id');
    }
}
