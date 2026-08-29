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
        return LoginHistory::query()->create([
            'user_id' => $user->user_id,
            'user_name' => $this->userName($user),
            'email' => mb_strtolower(trim($user->email)),
            'ip_address' => $this->ipAddress($request),
            'user_agent' => $this->userAgent($request),
            'status' => 'success',
            'failure_reason' => null,
            'attempted_at' => now(),
        ]);
    }

    public function recordFailedLogin(
        string $email,
        Request $request
    ): LoginHistory {
        $normalizedEmail = mb_strtolower(trim($email));

        /*
         * Associate the attempt with an existing account when one exists.
         * This information is stored only in the protected administrative
         * history
         */
        $user = User::query()
            ->where('email', $normalizedEmail)
            ->first();

        return LoginHistory::query()->create([
            'user_id' => $user?->user_id,
            'user_name' => $user
                ? $this->userName($user)
                : null,
            'email' => $normalizedEmail,
            'ip_address' => $this->ipAddress($request),
            'user_agent' => $this->userAgent($request),
            'status' => 'failed',
            'failure_reason' => 'invalid_credentials',
            'attempted_at' => now(),
        ]);
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