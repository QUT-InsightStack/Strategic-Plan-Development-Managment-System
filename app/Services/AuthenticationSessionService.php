<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tymon\JWTAuth\Exceptions\JWTException;
use Tymon\JWTAuth\Exceptions\TokenBlacklistedException;
use Tymon\JWTAuth\Exceptions\TokenExpiredException;
use Tymon\JWTAuth\Exceptions\TokenInvalidException;
use Tymon\JWTAuth\Facades\JWTAuth;
use Tymon\JWTAuth\Payload;

class AuthenticationSessionService
{
    public function __construct(
        private readonly AuthSessionService $sessions,
        private readonly SystemSettingsService $settings
    ) {
    }

    public function refresh(): array
    {
        $payload = $this->decodeForRefresh();

        $userId = (int) $payload->get('sub');
        $version = (int) $payload->get('auth_version');
        $sid = $payload->get('sid');

        if (
            $userId < 1
            || $version < 1
            || ! is_string($sid)
            || ! Str::isUuid($sid)
        ) {
            return ['status' => 'invalid'];
        }

        /*
         * Consistent lock order: user first, session second.
         * No transaction retry: JWT blacklist writes are not transactional
         * with the application database.
         */
        return DB::transaction(function () use (
            $userId,
            $version,
            $sid
        ): array {
            $user = User::query()
                ->lockForUpdate()
                ->find($userId);

            if (
                ! $user
                || $user->status !== 'active'
                || (int) $user->auth_version !== $version
            ) {
                return ['status' => 'invalid'];
            }

            $session = $this->sessions->validLocked($sid, $userId);

            if (! $session) {
                return ['status' => 'invalid'];
            }

            if (
                $this->settings->current()->maintenance_enabled
                && ! $user->role?->permissions()
                    ->where('code', 'settings.manage')
                    ->exists()
            ) {
                return ['status' => 'maintenance'];
            }

            /*
             * Decode again after obtaining locks.
             * Another concurrent refresh may have blacklisted the old token
             * while this request was waiting.
             */
            $this->decodeForRefresh();

            $token = Auth::guard('api')->refresh();

            return [
                'status' => 'success',
                'token' => $token,
            ];
        });
    }

    public function logout(): void
    {
        try {
            $payload = $this->decodeForRefresh();
        } catch (
            TokenBlacklistedException
            | TokenExpiredException
            | TokenInvalidException $exception
        ) {
            /*
             * expired here means outside the refresh window.
             * Such a token cannot obtain another valid session.
             */
            return;
        } catch (JWTException $exception) {
            /*
             * Missing token is normal for idempotent logout.
             * Unexpected JWT failures should not all be silently ignored.
             */
            if (! JWTAuth::getToken()) {
                return;
            }

            throw $exception;
        }

        $sid = $payload->get('sid');
        $userId = (int) $payload->get('sub');

        if (
            is_string($sid)
            && Str::isUuid($sid)
            && $userId > 0
        ) {
            /*
             * Commit revocation before blacklisting. Even if blacklist
             * storage subsequently fails, session enforcement blocks reuse.
             */
            $this->sessions->revoke($sid, $userId);
        }

        /*
         * Enable refresh-flow validation so an expired access JWT can still
         * be invalidated while inside its refresh window.
         */
        $manager = JWTAuth::manager();

        try {
            $manager->setRefreshFlow(true);
            JWTAuth::invalidate();
        } finally {
            $manager->setRefreshFlow(false);
        }
    }

    private function decodeForRefresh(): Payload
    {
        $jwt = JWTAuth::parseToken();
        $manager = $jwt->manager();

        try {
            $manager->setRefreshFlow(true);

            return $manager->decode($jwt->getToken());
        } finally {
            $manager->setRefreshFlow(false);
        }
    }
}