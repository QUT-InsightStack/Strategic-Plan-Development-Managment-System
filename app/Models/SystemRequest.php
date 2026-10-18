<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemRequest extends Model
{
    protected $table = 'tblsystem_requests';

    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'status_code' => 'integer',
            'duration_ms' => 'float',
            'db_duration_ms' => 'float',
            'db_query_count' => 'integer',
            'occurred_at' => 'immutable_datetime',
        ];
    }
}
