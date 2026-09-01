<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Backup extends Model
{
    use HasFactory;

    protected $table = 'tblbackups';
    protected $primaryKey = 'backup_id';

    protected $fillable = [
        'filename',
        'size_bytes',
        'driver',
        'status',
        'error_message',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by', 'user_id');
    }

    public function isDownloadable(): bool
    {
        return $this->status === 'completed';
    }

    public function isRestorable(): bool
    {
        return $this->status === 'completed';
    }
}
