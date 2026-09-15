<?php

namespace App\Services;

use App\Models\LoginAttemptState;
use App\Repositories\LoginAttemptStateRepository;
use App\Repositories\UserRepository;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AuthenticationLoginService
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly LoginAttemptStateRepository $attempts,
        private readonly AuthSessionService $sessions,
        private readonly SystemSettingsService $settings,
        private readonly LoginHistoryRecorder $history
    ) {
    }

    public function login(string $email, string $password, Request $request): array
    {
        $email = mb_strtolower(trim($email));
        $hash = hash('sha256', $email);

        /*
         * Do not enable automatic transaction retries here: issuing JWTs
         * and recording authentication activity must not be repeated blindly.
         */
        return DB::transaction(function () use (
            $email,
            $password,
            $hash,
            $request
        ): array {
            $state = $this->attempts->getLocked($hash);
            $now = now();

            if ($state->locked_until?->isFuture()) {
                $this->history->recordFailedLogin(
                    $email,
                    $request,
                    'locked_out'
                );

                return [
                    'status' => 'locked',
                    'retry_after' => max(
                        1,
                        $state->locked_until->getTimestamp() - $now->getTimestamp()
                    ),
                ];
            }

            $windowMinutes = (int) config(
                'security.login_failure_window_minutes',
                15
            );

            if (
                $state->locked_until !== null
                || $state->window_started_at === null
                || $state->window_started_at
                    ->addMinutes($windowMinutes)
                    ->lessThanOrEqualTo($now)
            ) {
                $this->clear($state);
                $state->window_started_at = $now;
            }

            $user = $this->users->findByEmailLocked($email);

            $matches = false;

            if ($user) {
                $matches = Hash::check($password, $user->password);
            } else {
                password_verify(
                    $password,
                    (string) config('security.dummy_password_hash')
                );
            }

            if (! $user || ! $matches || $user->status !== 'active') {
                $state->failed_attempts++;

                $limit = $this->settings->current()->login_attempt_limit;

                if ($state->failed_attempts >= $limit) {
                    $state->locked_until = $now->copy()->addMinutes(
                        (int) config('security.login_lockout_minutes', 15)
                    );
                }

                $this->attempts->save($state);

                $this->history->recordFailedLogin(
                    $email,
                    $request,
                    'invalid_credentials'
                );

                return [
                    'status' => $state->locked_until ? 'locked' : 'invalid',
                    'retry_after' => $state->locked_until
                        ? max(
                            1,
                            $state->locked_until->getTimestamp()
                                - $now->getTimestamp()
                        )
                        : null,
                ];
            }

            $this->clear($state);
            $this->attempts->save($state);

            if (
                $this->settings->current()->maintenance_enabled
                && ! $user->role?->permissions()
                    ->where('code', 'settings.manage')
                    ->exists()
            ) {
                return ['status' => 'maintenance'];
            }

            /*
             * The user row remains locked from credential verification
             * through session creation and token issuance.
             */
            $session = $this->sessions->create($user);

            $guard = Auth::guard('api');

            try {
                $token = $guard
                    ->claims(['sid' => $session->id])
                    ->login($user);
            } finally {
                $guard->claims([]);
            }

            $this->history->recordSuccessfulLogin($user, $request);

            return [
                'status' => 'success',
                'token' => $token,
            ];
        });
    }

    private function clear(LoginAttemptState $state): void
    {
        $state->failed_attempts = 0;
        $state->window_started_at = null;
        $state->locked_until = null;
    }
}