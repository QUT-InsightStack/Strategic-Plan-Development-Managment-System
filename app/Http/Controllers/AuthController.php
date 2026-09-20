<?php

namespace App\Http\Controllers;

use App\Http\Requests\ChangePasswordRequest;
use App\Http\Requests\ForgotPasswordRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log as SystemLog;
use Illuminate\Support\Facades\Password;
use Tymon\JWTAuth\Exceptions\JWTException;
use Tymon\JWTAuth\Exceptions\TokenBlacklistedException;
use Tymon\JWTAuth\Exceptions\TokenExpiredException;
use Tymon\JWTAuth\Exceptions\TokenInvalidException;
use Tymon\JWTAuth\Facades\JWTAuth;
use App\Http\Requests\LoginRequest;
use App\Services\LoginHistoryRecorder;
use App\Services\SecuritySettingsService;
use App\Http\Requests\ResetPasswordRequest;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Requests\UploadProfilePhotoRequest;
use App\Http\Resources\UserResource;
use App\Models\Log as LogModel;
use App\Services\ProfilePhotoService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Cookie;

class AuthController extends Controller
{
    // ─── Login ───────────────────────────────────────────────────────

    public function __construct(
        private readonly LoginHistoryRecorder $loginHistoryRecorder,
        private ProfilePhotoService $profilePhotos,
        private readonly SecuritySettingsService $securitySettings,
        private readonly \App\Contracts\StrategicLogWriter $logWriter
    ) {
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = [
            ...$request->only('email', 'password'),
            'status' => 'active',
        ];

        $existingUser = User::query()->where('email', $request->validated('email'))->first();
        if ($existingUser?->locked_until?->isFuture()) {
            $this->loginHistoryRecorder->recordFailedLogin(
                (string) $request->validated('email'), $request, 'account_locked'
            );
            $minutes = max(1, now()->diffInMinutes($existingUser->locked_until, false));
            return response()->json([
                'success' => false,
                'message' => "This account is locked. Try again in " . round($minutes, 2) . " minute(s).",
                'locked_until' => $existingUser->locked_until->toIso8601String(),
            ], 423);
        }

        if ($existingUser?->locked_until?->isPast()) {
            $existingUser->forceFill(['failed_login_attempts' => 0, 'locked_until' => null])->save();
        }

        $token = Auth::guard('api')->attempt($credentials);

        if (! $token) {
            if ($existingUser) {
                DB::transaction(function () use ($existingUser): void {
                    $user = User::query()->lockForUpdate()->find($existingUser->user_id);
                    if (! $user || $user->locked_until?->isFuture()) return;
                    $user->failed_login_attempts++;
                    if ($user->failed_login_attempts >= $this->securitySettings->get('max_failed_login_attempts')) {
                        $user->locked_until = now()->addMinutes($this->securitySettings->get('lockout_duration_minutes'));
                    }
                    $user->save();
                });

                $existingUser->refresh();
                if ($existingUser->locked_until?->isFuture()) {
                    $minutes = max(1, now()->diffInMinutes($existingUser->locked_until, false));

                    $this->loginHistoryRecorder->recordFailedLogin(
                        (string) $request->validated('email'),
                        $request,
                        'account_locked'
                    );

                    return response()->json([
                        'success' => false,
                        'message' => "This account is now locked. Try again in " . round($minutes, 2) . " minute(s).",
                        'locked_until' => $existingUser->locked_until->toIso8601String(),
                    ], 423);
                }
            }
            $this->loginHistoryRecorder->recordFailedLogin(
                (string) $request->validated('email'),
                $request,
                ! $existingUser ? 'unknown_email' : ($existingUser->status !== 'active' ? 'inactive_account' : 'invalid_credentials')
            );

            /*
            * Keep the response generic. Never reveal whether the submitted
            * email belongs to an existing account.
            */
            return response()->json([
                'success' => false,
                'message' => 'The provided credentials are incorrect.',
            ], 401);
        }

        $user = Auth::guard('api')->user();

        if (! $user instanceof User) {
            /*
            * this should not ordinarily happen after a successful attempt.
            * Invalidate the newly generated token if authentication state
            * cannot be resolved.
            */
            Auth::guard('api')->logout();

            return response()->json([
                'success' => false,
                'message' => 'Unable to complete authentication.',
            ], 401)->withCookie($this->forgetAccessCookie());
        }

        $this->loginHistoryRecorder->recordSuccessfulLogin(
            $user,
            $request
        );

        $user->forceFill(['failed_login_attempts' => 0, 'locked_until' => null, 'last_activity_at' => now()])->save();

        return response()->json([
            'success' => true,
            'message' => 'Logged in successfully.',
            'token' => $token,
        ])->withCookie($this->makeAccessCookie($token));
    }

    // ─── Logout ──────────────────────────────────────────────────────

    /**
     * Terminate the session.
     *
     * Deliberately idempotent: logging out twice, or with a missing or
     * already-blacklisted token, still returns 200 and still clears the
     * cookie. A caller asking to be logged out should never be told the
     * request failed, and any error here would leave the cookie in place.
     */
    public function logout(): JsonResponse
    {
        try {
            // Resolve the user before invalidating, so the audit row can
            // attribute the event. Fails silently if the token is bad.
            $user = Auth::guard('api')->user();

            if ($user) {
                // Session invalidation must complete even if audit persistence fails.
                Auth::guard('api')->logout();
                $this->logWriter->write('auth.logout', [
                    'actor_user_id' => $user->user_id,
                    'resource_type' => 'user', 'resource_id' => $user->user_id,
                    'states'    => 'success',
                ]);
            }

            if (! $user) {
                Auth::guard('api')->logout();
            }
        } catch (\Throwable $e) {
            // Token was absent, malformed or already blacklisted. The
            // desired end state — no valid session — already holds.
        }

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ])->withCookie($this->forgetAccessCookie());
    }

    // ─── Refresh ─────────────────────────────────────────────────────

    /**
 * Rotate an access token within the configured refresh window.
 *
 * This route accepts expired access tokens, so it cannot use auth:api.
 * The token is decoded in refresh mode before rotation so auth_version
 * can be compared with the current user record.
 */
    public function refresh(): JsonResponse
    {
        try {
            $jwt = JWTAuth::parseToken();
            $manager = $jwt->manager();


            try {
                // Refresh flow permits an expired access token when it is
                // still within JWT_REFRESH_TTL.
                $manager->setRefreshFlow(true);


                $payload = $manager->decode(
                    $jwt->getToken()
                );
            } finally {
                // Do not leave the shared manager in refresh mode.
                $manager->setRefreshFlow(false);
            }


            $userId = (int) $payload->get('sub');
            $tokenVersion = (int) $payload->get('auth_version');


            if ($userId < 1 || $tokenVersion < 1) {
                return $this->invalidatedSessionResponse();
            }


            /*
            * UserRoleService uses lockForUpdate() while changing roles.
            * Taking the same lock here prevents a role change from occurring
            * between the version comparison and token rotation.
            */
            $newToken = DB::transaction(function () use (
                $userId,
                $tokenVersion
            ): ?string {
                $user = User::query()
                    ->lockForUpdate()
                    ->find($userId);


                if (
                    ! $user
                    || $tokenVersion !== (int) $user->auth_version
                ) {
                    return null;
                }


                return Auth::guard('api')->refresh();
            });


            if (! $newToken) {
                return $this->invalidatedSessionResponse();
            }


            return response()->json([
                'success' => true,
                'message' => 'Token refreshed successfully.',
            ])->withCookie($this->makeAccessCookie($newToken));
        } catch (TokenBlacklistedException $e) {
            SystemLog::notice('Rejected refresh using a blacklisted JWT.', [
                'exception' => $e,
            ]);


            return response()->json([
                'success' => false,
                'message' => 'Authentication session expired.',
            ], 401)->withCookie($this->forgetAccessCookie());
        } catch (TokenExpiredException $e) {
            SystemLog::notice('Rejected JWT outside the refresh window.', [
                'exception' => $e,
            ]);


            return response()->json([
                'success' => false,
                'message' => 'Token has expired and cannot be refreshed.',
            ], 401)->withCookie($this->forgetAccessCookie());
        } catch (TokenInvalidException $e) {
            SystemLog::notice('Rejected invalid JWT refresh request.', [
                'exception' => $e,
            ]);


            return response()->json([
                'success' => false,
                'message' => 'Token is invalid.',
            ], 401)->withCookie($this->forgetAccessCookie());
        } catch (JWTException $e) {
            SystemLog::warning('Unable to refresh JWT.', [
                'exception' => $e,
            ]);


            return response()->json([
                'success' => false,
                'message' => 'Unable to refresh token.',
            ], 401)->withCookie($this->forgetAccessCookie());
        } catch (\Throwable $e) {
            SystemLog::error('Unexpected JWT refresh failure.', [
                'exception' => $e,
            ]);
            app(\App\Services\SystemEventRecorder::class)->record('auth.refresh_failed', 'auth', 'error', 'failure', ['exception_type' => $e::class]);


            return response()->json([
                'success' => false,
                'message' => 'Unable to refresh token.',
            ], 500)->withCookie($this->forgetAccessCookie());
        }
    }

    // ─── Me ──────────────────────────────────────────────────────────

    public function me(): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $user->load(['role.permissions']);

        return response()->json([
            'success' => true,
            'data'    => [
                ...$user->toArray(),
                'permissions' => $user->role?->permissions?->pluck('code')->values()->all() ?? [],
            ],
        ]);
    }

    private function invalidatedSessionResponse(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Authentication session expired.',
        ], 401)->withCookie($this->forgetAccessCookie());
    }

    // ─── Cookie Helpers ──────────────────────────────────────────────

    /**
     * to build the HttpOnly access_token cookie.
     *
     * - HttpOnly = true  → JavaScript cannot read it (XSS protection)
     * - Secure   = env   → true in production (HTTPS only), false for local HTTP
     * - SameSite = Lax   → blocks cross-site POST (CSRF protection)
     * - TTL      = jwt   → cookie expires when the JWT expires
     */
    protected function makeAccessCookie(string $token): Cookie
{
    /*
     * The JWT itself expires after JWT_TTL, but the cookie must remain
     * available through JWT_REFRESH_TTL so an expired JWT can be rotated.
     */
    $minutes = (int) config(
        'jwt.refresh_ttl',
        10080
    );


    $secure = filter_var(
        env('JWT_COOKIE_SECURE', false),
        FILTER_VALIDATE_BOOLEAN
    );


    return cookie(
        'access_token',
        $token,
        $minutes,
        '/',
        null,
        $secure,
        true,
        false,
        'Lax'
    );
}


    /**
     * Create an expired cookie to clear the token from the browser.
     */
    protected function forgetAccessCookie(): Cookie
    {
        $secure = filter_var(
            env('JWT_COOKIE_SECURE', false),
            FILTER_VALIDATE_BOOLEAN
        );

        return cookie(
            'access_token',
            '',
            -1,                 // negative = expired immediately
            '/',
            null,
            $secure,
            true,
            false,
            'Lax'
        );
    }

    /**
     * Update the authenticated user's own profile.
     *
     * The user is resolved from the token, never from request input, so this
     * endpoint cannot be used to modify another account. Restricted fields
     * are rejected during validation, and only validated values reach the
     * model, so role, status and organisational placement are unaffected.
     */
    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = Auth::guard('api')->user();

        $user->fill($request->validated());

        $changed = array_keys($user->getDirty());

        if ($changed === []) {
            return response()->json([
                'success' => true,
                'message' => 'No changes were made.',
                'data'    => new UserResource($user->load('role')),
            ]);
        }

        $user->save();
        LogModel::create([
            'user_id'   => $user->user_id,
            'operation' => 'Profile updated: ' . implode(', ', $changed),
            'states'    => 'success',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'data'    => new UserResource($user->load('role')),
        ]);
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = Auth::guard('api')->user();

        if (! Hash::check((string) $request->input('current_password'), (string) $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        DB::transaction(function () use ($user, $request): void {
            $lockedUser = User::query()
                ->lockForUpdate()
                ->findOrFail($user->user_id);

            if (! Hash::check((string) $request->input('current_password'), (string) $lockedUser->password)) {
                throw ValidationException::withMessages([
                    'current_password' => ['The current password is incorrect.'],
                ]);
            }

            $lockedUser->password = (string) $request->input('new_password');
            $lockedUser->auth_version++;
            $lockedUser->setRememberToken(Str::random(60));
            $lockedUser->save();

            LogModel::create([
                'user_id' => $lockedUser->user_id,
                'operation' => json_encode([
                    'event' => 'auth.password_changed',
                ], JSON_UNESCAPED_SLASHES),
                'states' => 'success',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Password updated successfully. Please sign in again.',
            'reauthentication_required' => true,
        ])->withCookie($this->forgetAccessCookie());
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $email = (string) $request->input('email');
        $user = User::query()
            ->where('email', $email)
            ->where('status', 'active')
            ->first();

        if ($user) {
            try {
                Password::broker()->sendResetLink(['email' => $email]);
            } catch (\Throwable $e) {
                app(\App\Services\SystemEventRecorder::class)->record('auth.password_reset_delivery_failed', 'auth', 'error', 'failure', ['exception_type' => $e::class]);
                SystemLog::error('Unable to send password reset link.', [
                    'email' => $email,
                    'exception' => $e,
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Unable to process the request. Please try again later.',
                ], 500);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'If an account exists for this email address, password reset instructions will be sent.',
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::broker()->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                DB::transaction(function () use ($user, $password): void {
                    $lockedUser = User::query()
                        ->lockForUpdate()
                        ->findOrFail($user->user_id);

                    $lockedUser->password = $password;
                    $lockedUser->auth_version++;
                    $lockedUser->setRememberToken(Str::random(60));
                    $lockedUser->save();

                    LogModel::create([
                        'user_id' => $lockedUser->user_id,
                        'operation' => json_encode([
                            'event' => 'auth.password_reset',
                        ], JSON_UNESCAPED_SLASHES),
                        'states' => 'success',
                    ]);

                    event(new PasswordReset($lockedUser));
                });
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'success' => false,
                'message' => __($status),
                'errors' => [
                    'token' => [__($status)],
                ],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Password has been reset successfully. Please sign in.',
            'reauthentication_required' => true,
        ]);
    }

    // ─── Profile photo ───────────────────────────────────────────────

    /**
     * Replace the signed-in user's photo.
     *
     * Separate from updateProfile because this takes a file rather than JSON.
     * The photo is stored on disk and only its path is written to the user
     * record, which is why `profile_picture` is rejected by the profile
     * endpoint: sending the image itself never worked, as the column is far
     * too small to hold one.
     */
    public function uploadPhoto(UploadProfilePhotoRequest $request): JsonResponse
    {
        $user = $this->profilePhotos->store(
            Auth::guard('api')->user(),
            $request->file('photo')
        );

        return response()->json([
            'success' => true,
            'message' => 'Photo updated successfully.',
            'data'    => new UserResource($user->load('role')),
        ]);
    }

    /**
     * Remove the signed-in user's photo, reverting to the default avatar.
     */
    public function removePhoto(): JsonResponse
    {
        $user = $this->profilePhotos->remove(Auth::guard('api')->user());

        return response()->json([
            'success' => true,
            'message' => 'Photo removed successfully.',
            'data'    => new UserResource($user->load('role')),
        ]);
    }
}
