<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Tymon\JWTAuth\Exceptions\JWTException;
use Tymon\JWTAuth\Exceptions\TokenBlacklistedException;
use Tymon\JWTAuth\Exceptions\TokenExpiredException;
use Tymon\JWTAuth\Exceptions\TokenInvalidException;
use Tymon\JWTAuth\Facades\JWTAuth;
use App\Http\Requests\LoginRequest;
use App\Models\Log;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Cookie;

class AuthController extends Controller
{
    // ─── Login ───────────────────────────────────────────────────────

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->only('email', 'password');

        $token = Auth::guard('api')->attempt($credentials);

        if (! $token) {
            // generic message — never reveal whether the email exists
            return response()->json([
                'success' => false,
                'message' => 'The provided credentials are incorrect.',
            ], 401);
        }

        return response()->json([
            'success' => true,
            'message' => 'Logged in successfully.',
            'token'   => $token,
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
                Log::create([
                    'user_id'   => $user->user_id,
                    'operation' => 'logout',
                    'states'    => 'success',
                ]);
            }

            Auth::guard('api')->logout();   // blacklists current token
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
            Log::notice('Rejected refresh using a blacklisted JWT.', [
                'exception' => $e,
            ]);


            return response()->json([
                'success' => false,
                'message' => 'Authentication session expired.',
            ], 401)->withCookie($this->forgetAccessCookie());
        } catch (TokenExpiredException $e) {
            Log::notice('Rejected JWT outside the refresh window.', [
                'exception' => $e,
            ]);


            return response()->json([
                'success' => false,
                'message' => 'Token has expired and cannot be refreshed.',
            ], 401)->withCookie($this->forgetAccessCookie());
        } catch (TokenInvalidException $e) {
            Log::notice('Rejected invalid JWT refresh request.', [
                'exception' => $e,
            ]);


            return response()->json([
                'success' => false,
                'message' => 'Token is invalid.',
            ], 401)->withCookie($this->forgetAccessCookie());
        } catch (JWTException $e) {
            Log::warning('Unable to refresh JWT.', [
                'exception' => $e,
            ]);


            return response()->json([
                'success' => false,
                'message' => 'Unable to refresh token.',
            ], 401)->withCookie($this->forgetAccessCookie());
        } catch (\Throwable $e) {
            Log::error('Unexpected JWT refresh failure.', [
                'exception' => $e,
            ]);


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

    public function updateProfile(Request $request): JsonResponse
{
    $user = Auth::guard('api')->user();

    $request->validate([
        'first_name'      => 'required|string|max:255',
        'last_name'       => 'nullable|string|max:255',
        'email'           => 'required|email|unique:tblusers,email,' . $user->user_id . ',user_id',
        'mobile'          => 'nullable|string|max:20',
        'address'         => 'nullable|string|max:255',
        'profile_picture' => 'nullable|string',
    ]);

    $user->update($request->only([
        'first_name', 'last_name', 'email',
        'mobile', 'address', 'profile_picture',
    ]));

    return response()->json([
        'success' => true,
        'message' => 'Profile updated successfully.',
        'data'    => $user->fresh(),
    ]);
}
}
