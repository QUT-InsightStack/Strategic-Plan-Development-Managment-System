<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Builder;
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
        static::creating(function (Log $log): void {
            $log->outcome = $log->effectiveOutcome();
        });

        static::updating(function (): never {
            throw new LogicException('Audit records cannot be updated.');
        });

        static::deleting(function (): never {
            throw new LogicException('Audit records cannot be deleted.');
        });
    }

    public function eventName(): string
    {
        $payload = json_decode((string) $this->operation, true);

        return is_array($payload) && is_string($payload['event'] ?? null)
            ? $payload['event'] : (string) $this->operation;
    }

    public function eventMetadata(): ?array
    {
        $payload = json_decode((string) $this->operation, true);
        $legacy = is_array($payload) && is_string($payload['event'] ?? null) ? $payload : [];
        unset($legacy['event']);

        return array_merge($legacy, $this->metadata ?? []) ?: null;
    }

    public function effectiveOutcome(): string
    {
        if (in_array($this->outcome, ['failure', 'denied'], true)) {
            return $this->outcome;
        }

        return match ($this->states) {
            'failed', 'failure' => 'failure',
            'denied' => 'denied',
            default => $this->outcome ?? 'success',
        };
    }

    // Preserve historical audit rows while exposing their effective values.
    public static function outcomeSql(): string
    {
        return "CASE WHEN tbllog.outcome IN ('failure', 'denied') THEN tbllog.outcome "
            . "WHEN tbllog.states IN ('failed', 'failure') THEN 'failure' "
            . "WHEN tbllog.states = 'denied' THEN 'denied' ELSE tbllog.outcome END";
    }

    public function scopeForOutcome(Builder $query, string $outcome): Builder
    {
        return $query->whereRaw(self::outcomeSql() . ' = ?', [$outcome]);
    }

    public function scopeForAction(Builder $query, string $action): Builder
    {
        // JSON_VALID guards plain-text and malformed legacy operation values.
        $json = "CASE WHEN JSON_VALID(tbllog.operation) THEN tbllog.operation ELSE '{}' END";
        $event = "JSON_EXTRACT($json, '$.event')";
        if (in_array($query->getConnection()->getDriverName(), ['mysql', 'mariadb'], true)) {
            $event = "CASE WHEN JSON_TYPE($event) = 'STRING' THEN JSON_UNQUOTE($event) END";
        } else {
            $event = "CASE WHEN JSON_TYPE($json, '$.event') = 'text' THEN $event END";
        }

        return $query->where(function (Builder $query) use ($action, $event): void {
            $query->where('tbllog.operation', $action)->orWhereRaw($event . ' = ?', [$action]);
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
