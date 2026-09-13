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
use Tymon\JWTAuth\Facades\JWTAuth;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\ResetPasswordRequest;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Requests\UploadProfilePhotoRequest;
use App\Http\Resources\UserResource;
use App\Contracts\StrategicLogWriter;
use App\Services\AccessTokenCookieService;
use App\Services\AuthenticationLoginService;
use App\Services\AuthenticationSessionService;
use App\Models\Log as LogModel;
use App\Services\ProfilePhotoService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Cookie;

class AuthController extends Controller
{
   

    public function __construct(
        private readonly AuthenticationLoginService $loginService,
        private readonly AuthenticationSessionService $sessionService,
        private readonly AccessTokenCookieService $accessCookies,
        private readonly StrategicLogWriter $auditWriter,
        private readonly ProfilePhotoService $profilePhotos
    ) {
    }
    

    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->loginService->login(
            (string) $request->validated('email'),
            (string) $request->validated('password'),
            $request
        );

        if ($result['status'] === 'locked') {
            return response()->json([
                'success' => false,
                'message' => 'Too many failed login attempts. Please try again later.',
            ], 429, [
                'Retry-After' => (string) $result['retry_after'],
            ]);
        }

        if ($result['status'] === 'invalid') {
            return response()->json([
                'success' => false,
                'message' => 'The provided credentials are incorrect.',
            ], 401);
        }

        if ($result['status'] === 'maintenance') {
            return response()->json([
                'success' => false,
                'message' => 'The system is temporarily unavailable for maintenance.',
            ], 503, [
                'Retry-After' => '60',
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Logged in successfully.',
        ])->withCookie($this->makeAccessCookie($result['token']));
    }

    public function logout(): JsonResponse
    {
        try {
            $this->sessionService->logout();
        } catch (\Throwable $exception) {
            report($exception);
    
            return response()->json([
                'success' => false,
                'message' => 'The cookie was cleared, but server-side logout could not be confirmed.',
            ], 503)->withCookie($this->forgetAccessCookie());
        }
    
        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ])->withCookie($this->forgetAccessCookie());
    }
  
    public function refresh(): JsonResponse
    {
        try {
            $result = $this->sessionService->refresh();
    
            if ($result['status'] === 'maintenance') {
                return response()->json([
                    'success' => false,
                    'message' => 'The system is temporarily unavailable for maintenance.',
                ], 503, [
                    'Retry-After' => '60',
                ]);
            }
    
            if ($result['status'] !== 'success') {
                return $this->invalidatedSessionResponse();
            }
    
            return response()->json([
                'success' => true,
                'message' => 'Token refreshed successfully.',
            ])->withCookie($this->makeAccessCookie($result['token']));
        } catch (JWTException $exception) {
            return $this->invalidatedSessionResponse();
        } catch (\Throwable $exception) {
            report($exception);
    
            return response()->json([
                'success' => false,
                'message' => 'Unable to refresh the authentication session.',
            ], 503);
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
     * - TTL      = refresh window → cookie remains available for token refresh
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

            $this->auditWriter->write('auth.password_changed', [
                'actor_user_id' => $lockedUser->user_id,
                'resource_type' => 'user',
                'resource_id' => $lockedUser->user_id,
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

                    if ($lockedUser->status !== 'active') {
                        throw ValidationException::withMessages([
                            'token' => ['This password reset request cannot be completed.'],
                        ]);
                    }

                    $lockedUser->password = $password;
                    $lockedUser->auth_version++;
                    $lockedUser->setRememberToken(Str::random(60));
                    $lockedUser->save();

                    $this->auditWriter->write('auth.password_reset', [
                        'actor_user_id' => $lockedUser->user_id,
                        'resource_type' => 'user',
                        'resource_id' => $lockedUser->user_id,
                    ]);

                    DB::afterCommit(
                        fn () => event(new PasswordReset($lockedUser))
                    );
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
