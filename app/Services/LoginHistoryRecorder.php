<?php

namespace App\Services;

use App\Models\LoginHistory;
use App\Models\User;
use Illuminate\Http\Request;

class LoginHistoryRecorder
{
    public function recordSuccessfulLogin(
        User $user,
        Request $request
    ): LoginHistory {
        $history = LoginHistory::query()->create([
            'user_id' => $user->user_id,
            'user_name' => $this->userName($user),
            'email' => mb_strtolower(trim($user->email)),
            'ip_address' => $this->ipAddress($request),
            'user_agent' => $this->userAgent($request),
            'status' => 'success',
            'failure_reason' => null,
            'attempted_at' => now(),
        ]);
        app(SystemEventRecorder::class)->record('auth.login_succeeded', 'auth', 'info', 'success', [
            'actor_user_id' => $user->user_id, 'login_history_id' => $history->login_history_id,
        ]);
        return $history;
    }

    public function recordFailedLogin(
        string $email,
        Request $request,
        string $reason = 'invalid_credentials'
    ): LoginHistory {
        $normalizedEmail = mb_substr(mb_strtolower(trim($email)), 0, 255);
        if (! in_array($reason, ['invalid_credentials', 'unknown_email', 'inactive_account', 'account_locked', 'rate_limited'], true)) {
            throw new \InvalidArgumentException('Unknown login failure reason.');
        }

        /*
         * Associate the attempt with an existing account when one exists.
         * This information is stored only in the protected administrative
         * history
         */
        $user = User::query()
            ->where('email', $normalizedEmail)
            ->first();

        $history = LoginHistory::query()->create([
            'user_id' => $user?->user_id,
            'user_name' => $user
                ? $this->userName($user)
                : null,
            'email' => $normalizedEmail,
            'ip_address' => $this->ipAddress($request),
            'user_agent' => $this->userAgent($request),
            'status' => 'failed',
            'failure_reason' => $reason,
            'attempted_at' => now(),
        ]);
        app(SystemEventRecorder::class)->record(match ($reason) {
            'account_locked' => 'auth.account_locked', 'rate_limited' => 'auth.rate_limited',
            default => 'auth.login_failed',
        }, 'auth', 'warning', 'failure', [
            'actor_user_id' => $user?->user_id, 'reason' => $reason,
            'login_history_id' => $history->login_history_id,
        ]);
        return $history;
    }

    private function userName(User $user): string
    {
        $name = trim(
            ($user->first_name ?? '')
            . ' '
            . ($user->last_name ?? '')
        );

        return $name !== ''
            ? $name
            : $user->email;
    }

    private function ipAddress(Request $request): ?string
    {
        $ipAddress = $request->ip();

        if (! is_string($ipAddress) || $ipAddress === '') {
            return null;
        }

        return mb_substr($ipAddress, 0, 45);
    }

    private function userAgent(Request $request): ?string
    {
        $userAgent = $request->userAgent();

        if (! is_string($userAgent) || $userAgent === '') {
            return null;
        }

        /*
         * Avoid storing an arbitrarily large request header.
         */
        return mb_substr($userAgent, 0, 2000);
    }
}
