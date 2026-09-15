<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuthSession extends Model
{
    protected $table = 'tblauth_sessions';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'user_id',
        'last_activity_at',
        'expires_at',
        'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'last_activity_at' => 'immutable_datetime',
            'expires_at' => 'immutable_datetime',
            'revoked_at' => 'immutable_datetime',
        ];
    }
}