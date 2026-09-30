<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemEvent extends Model
{
    protected $table = 'tblsystem_events';

    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['context' => 'array', 'occurred_at' => 'immutable_datetime'];
    }
}
