<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemAlert extends Model
{
    protected $table = 'tblsystem_alerts';

    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return array_fill_keys(['opened_at', 'last_seen_at', 'resolved_at', 'opening_notified_at', 'recovery_notified_at'], 'immutable_datetime');
    }
}
