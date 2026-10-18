<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PasswordAssistanceRequest extends Model
{
    public const PENDING = 'pending';
    public const ACCEPTED = 'accepted';
    public const ACTED_ON = 'acted_on';
    public const IGNORED = 'ignored';

    protected $fillable = [
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'open_slot' => 'integer',
            'accepted_at' => 'datetime',
            'handled_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function acceptedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by', 'user_id');
    }

    public function handledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by', 'user_id');
    }

    public function scopeOpen($query)
    {
        return $query->where('open_slot', 1);
    }
}