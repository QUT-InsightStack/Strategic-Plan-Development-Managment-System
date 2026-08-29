<?php

namespace App\Services;

use App\Models\LoginHistory;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log as SystemLog;
use Throwable;

class LoginHistoryService
{
    /**
     * Record a successful sign-in.
     */
    public function recordSuccess(User $user, Request $request): void
    {
        $this->write([
            'user_id' => $user->user_id,
            'email' => $user->email,
            'outcome' => LoginHistory::OUTCOME_SUCCESS,
            'reason' => null,
        ], $request);
    }

    /**
     * Record a rejected sign-in.
     *
     * The reason is worked out here rather than in the controller so the
     * response can stay generic: the caller is always told the same thing,
     * while the log keeps enough detail to tell a wrong password apart from
     * an attempt on a suspended account.
     */
    public function recordFailure(string $email, Request $request): void
    {
        $user = User::query()->where('email', $email)->first();

        $reason = match (true) {
            $user === null => LoginHistory::REASON_UNKNOWN_EMAIL,
            $user->status !== 'active' => LoginHistory::REASON_INACTIVE_ACCOUNT,
            default => LoginHistory::REASON_INVALID_CREDENTIALS,
        };

        $this->write([
            'user_id' => $user?->user_id,
            'email' => $email,
            'outcome' => LoginHistory::OUTCOME_FAILED,
            'reason' => $reason,
        ], $request);
    }

    /**
     * The signed-in user's own recent attempts, newest first.
     *
     * @return Collection<int, LoginHistory>
     */
    public function forUser(User $user, int $limit = 10): Collection
    {
        return LoginHistory::query()
            ->where('user_id', $user->user_id)
            ->orderByDesc('created_at')
            ->orderByDesc('login_history_id')
            ->limit($limit)
            ->get();
    }

    /**
     * Failed attempts against this account since a point in time — the
     * "somebody has been trying to get in" signal on the profile page.
     */
    public function recentFailureCount(User $user, int $days = 30): int
    {
        return LoginHistory::query()
            ->where('user_id', $user->user_id)
            ->failed()
            ->where('created_at', '>=', now()->subDays($days))
            ->count();
    }

    /**
     * The administrator view: every account, filtered.
     *
     * @param  array{user_id?:int|null,outcome?:string|null,search?:string|null,from?:string|null,to?:string|null,per_page?:int|null}  $filters
     */
    public function paginate(array $filters = []): LengthAwarePaginator
    {
        $query = LoginHistory::query()->with('user');

        if (! empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        if (! empty($filters['outcome'])) {
            $query->where('outcome', $filters['outcome']);
        }

        if (! empty($filters['search'])) {
            $term = $this->escapeLike($filters['search']);
            $query->where('email', 'like', "%{$term}%");
        }

        if (! empty($filters['from'])) {
            $query->where('created_at', '>=', $filters['from'] . ' 00:00:00');
        }

        if (! empty($filters['to'])) {
            $query->where('created_at', '<=', $filters['to'] . ' 23:59:59');
        }

        return $query
            ->orderByDesc('created_at')
            ->orderByDesc('login_history_id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();
    }

    /**
     * Delete entries older than the retention period.
     *
     * Login history is personal data — it ties a named person to an IP
     * address and a time — so it is not kept indefinitely.
     */
    public function prune(int $days): int
    {
        return LoginHistory::query()
            ->where('created_at', '<', now()->subDays($days))
            ->delete();
    }

    /**
     * Writing history must never stop somebody signing in, so a failure here
     * is reported to the application log and swallowed.
     */
    private function write(array $attributes, Request $request): void
    {
        try {
            LoginHistory::create([
                ...$attributes,
                'ip_address' => $request->ip(),
                // Capped well inside the column, and never rendered as HTML.
                'user_agent' => substr((string) $request->userAgent(), 0, 1000) ?: null,
            ]);
        } catch (Throwable $exception) {
            SystemLog::warning('Login history could not be recorded.', [
                'outcome' => $attributes['outcome'] ?? null,
                'exception' => $exception->getMessage(),
            ]);
        }
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $value);
    }
}
