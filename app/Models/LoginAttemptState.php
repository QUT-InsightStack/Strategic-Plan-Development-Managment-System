<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoginAttemptState extends Model
{
    protected $table = 'tbllogin_attempt_states';

    protected $primaryKey = 'identifier_hash';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'failed_attempts' => 'integer',
            'window_started_at' => 'immutable_datetime',
            'locked_until' => 'immutable_datetime',
        ];
    }
}