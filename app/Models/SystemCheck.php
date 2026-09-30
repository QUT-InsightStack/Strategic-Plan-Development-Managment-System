<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemCheck extends Model
{
    protected $table = 'tblsystem_checks';

    public $timestamps = false;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'health' => 'array',
            'metrics' => 'array',
            'issues' => 'array',
            'checked_at' => 'immutable_datetime',
        ];
    }
}
