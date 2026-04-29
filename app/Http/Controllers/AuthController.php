<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use Illuminate\Http\JsonResponse;
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
        ])->withCookie($this->makeAccessCookie($token));
    }

    // ─── Logout ──────────────────────────────────────────────────────

    public function logout(): JsonResponse
    {
        Auth::guard('api')->logout();       // blacklists current token

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ])->withCookie($this->forgetAccessCookie());
    }

    // ─── Refresh ─────────────────────────────────────────────────────

    /**
     * Rotate the JWT. This accepts expired tokens (within the
     * refresh_ttl window) so it must not sit behind auth:api
     * middleware which rejects expired tokens outright.
     */
    public function refresh(): JsonResponse
    {
        try {
            $newToken = Auth::guard('api')->refresh();
        } catch (\Tymon\JWTAuth\Exceptions\TokenInvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token is invalid.',
            ], 401)->withCookie($this->forgetAccessCookie());
        } catch (\Tymon\JWTAuth\Exceptions\TokenExpiredException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token has expired and cannot be refreshed.',
            ], 401)->withCookie($this->forgetAccessCookie());
        } catch (\Tymon\JWTAuth\Exceptions\JWTException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Unable to refresh token.',
            ], 401)->withCookie($this->forgetAccessCookie());
        }

        return response()->json([
            'success' => true,
            'message' => 'Token refreshed successfully.',
        ])->withCookie($this->makeAccessCookie($newToken));
    }

    // ─── Me ──────────────────────────────────────────────────────────

    public function me(): JsonResponse
    {
        $user = Auth::guard('api')->user();
        $user->load('role');

        return response()->json([
            'success' => true,
            'data'    => $user,
        ]);
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
        $minutes = (int) config('jwt.ttl', 30);
        $secure  = filter_var(
            env('JWT_COOKIE_SECURE', false),
            FILTER_VALIDATE_BOOLEAN
        );

        return cookie(
            'access_token',     // name
            $token,             // value
            $minutes,           // lifetime in minutes
            '/',                // path — sent on every request to this domain
            null,               // domain — current domain
            $secure,            // Secure flag
            true,               // HttpOnly flag
            false,              // raw
            'Lax'               // SameSite
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
}