<?php

namespace App\Services;

use App\Models\AuthSession;
use App\Models\User;
use App\Repositories\AuthSessionRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AuthSessionService
{
    public function __construct(
        private readonly AuthSessionRepository $repository,
        private readonly SystemSettingsService $settings
    ) {
    }

    public function create(User $user): AuthSession
    {
        $now = now();

        return $this->repository->create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->user_id,
            'last_activity_at' => $now,
            'expires_at' => $now->copy()->addMinutes(
                (int) config('security.session_absolute_lifetime_minutes', 10080)
            ),
        ]);
    }

    /**
     * Must be called inside an existing transaction.
     *
     * Expiration is persisted as revocation. Callers must return an invalid
     * result instead of throwing inside that transaction, otherwise the
     * revocation would be rolled back.
     */
    public function validLocked(string $id, int $userId): ?AuthSession
    {
        $session = $this->repository->findLocked($id);

        if (
            ! $session
            || $session->user_id !== $userId
            || $session->revoked_at !== null
        ) {
            return null;
        }

        $now = now();
        $idleMinutes = $this->settings->current()->session_idle_timeout_minutes;

        if (
            $session->expires_at->lessThanOrEqualTo($now)
            || $session->last_activity_at
                ->addMinutes($idleMinutes)
                ->lessThanOrEqualTo($now)
        ) {
            $session->revoked_at = $now;
            $this->repository->save($session);

            return null;
        }

        return $session;
    }

    public function check(string $id, int $userId): bool
    {
        return DB::transaction(
            fn (): bool => $this->validLocked($id, $userId) !== null
        );
    }

    /**
     * Called only after a successful application response.
     * Re-check under lock so another request cannot revive an expired row.
     */
    public function recordActivity(string $id, int $userId): void
    {
        DB::transaction(function () use ($id, $userId): void {
            $session = $this->validLocked($id, $userId);

            if (! $session) {
                return;
            }

            $session->last_activity_at = now();
            $this->repository->save($session);
        });
    }

    public function revoke(string $id, int $userId): void
    {
        DB::transaction(function () use ($id, $userId): void {
            $session = $this->repository->findLocked($id);

            if (
                ! $session
                || $session->user_id !== $userId
                || $session->revoked_at !== null
            ) {
                return;
            }

            $session->revoked_at = now();
            $this->repository->save($session);
        });
    }
}