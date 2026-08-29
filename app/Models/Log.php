<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class Log extends Model
{
    use HasFactory;

    protected $table = 'tbllog';

    protected $primaryKey = 'log_id';

    protected $fillable = [
        'user_id',
        'actor_name',
        'operation',
        'resource_type',
        'resource_id',
        'outcome',
        'states',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'resource_id' => 'integer',
            'metadata' => 'array',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (): never {
            throw new LogicException('Audit records cannot be updated.');
        });

        static::deleting(function (): never {
            throw new LogicException('Audit records cannot be deleted.');
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