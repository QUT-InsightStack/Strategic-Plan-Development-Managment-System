<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoginHistory extends Model
{
    use HasFactory;

    protected $table = 'tbllogin_history';
    protected $primaryKey = 'login_history_id';

    public const OUTCOME_SUCCESS = 'success';
    public const OUTCOME_FAILED = 'failed';

    /** Why an attempt failed. Recorded, never returned to the person signing in. */
    public const REASON_INVALID_CREDENTIALS = 'invalid_credentials';
    public const REASON_UNKNOWN_EMAIL = 'unknown_email';
    public const REASON_INACTIVE_ACCOUNT = 'inactive_account';

    protected $fillable = [
        'user_id',
        'email',
        'outcome',
        'reason',
        'ip_address',
        'user_agent',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function scopeSuccessful(Builder $query): Builder
    {
        return $query->where('outcome', self::OUTCOME_SUCCESS);
    }

    public function scopeFailed(Builder $query): Builder
    {
        return $query->where('outcome', self::OUTCOME_FAILED);
    }

    public function wasSuccessful(): bool
    {
        return $this->outcome === self::OUTCOME_SUCCESS;
    }

    /**
     * Short "Chrome on Windows" style label derived from the user agent.
     *
     * A rough match is enough for the only question this answers: does the
     * person recognise this sign-in as their own?
     */
    public function deviceLabel(): ?string
    {
        $agent = (string) $this->user_agent;

        if (trim($agent) === '') {
            return null;
        }

        $browser = match (true) {
            str_contains($agent, 'Edg/') => 'Edge',
            str_contains($agent, 'OPR/'), str_contains($agent, 'Opera') => 'Opera',
            str_contains($agent, 'Firefox/') => 'Firefox',
            // Chrome must be tested before Safari: Chrome sends both tokens.
            str_contains($agent, 'Chrome/') => 'Chrome',
            str_contains($agent, 'Safari/') => 'Safari',
            default => null,
        };

        $platform = match (true) {
            str_contains($agent, 'Windows') => 'Windows',
            str_contains($agent, 'iPhone'), str_contains($agent, 'iPad') => 'iOS',
            str_contains($agent, 'Android') => 'Android',
            str_contains($agent, 'Mac OS X') => 'macOS',
            str_contains($agent, 'Linux') => 'Linux',
            default => null,
        };

        return match (true) {
            $browser !== null && $platform !== null => "{$browser} on {$platform}",
            $browser !== null => $browser,
            $platform !== null => $platform,
            default => null,
        };
    }
}
