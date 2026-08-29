<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class LoginHistory extends Model
{
    use HasFactory;

    protected $table = 'tbllogin_history';

    protected $primaryKey = 'login_history_id';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'user_name',
        'email',
        'ip_address',
        'user_agent',
        'status',
        'failure_reason',
        'attempted_at',
    ];

    protected function casts(): array
    {
        return [
            'login_history_id' => 'integer',
            'user_id' => 'integer',
            'attempted_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        /*
         * Login-history records may be inserted but must not be changed or
         * deleted through normal Eloquent model operations.
         */
        static::updating(function (): never {
            throw new LogicException(
                'Login-history records cannot be updated.'
            );
        });

        static::deleting(function (): never {
            throw new LogicException(
                'Login-history records cannot be deleted.'
            );
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'user_id',
            'user_id'
        );
    }
}