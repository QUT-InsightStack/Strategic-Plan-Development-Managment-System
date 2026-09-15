<?php

namespace App\Http\Middleware;

use App\Services\AccessTokenCookieService;
use App\Services\AuthSessionService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Tymon\JWTAuth\Exceptions\JWTException;
use Tymon\JWTAuth\Facades\JWTAuth;

class ValidateAuthSession
{
    public function __construct(
        private readonly AuthSessionService $sessions,
        private readonly AccessTokenCookieService $cookies
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::guard('api')->user();

        try {
            $sid = JWTAuth::parseToken()->getPayload()->get('sid');
        } catch (JWTException) {
            return $this->expired();
        }

        if (
            ! $user
            || ! is_string($sid)
            || ! Str::isUuid($sid)
            || ! $this->sessions->check($sid, (int) $user->user_id)
        ) {
            return $this->expired();
        }

        $response = $next($request);

        /*
         * Successful application calls count as activity.
         * auth/me is excluded because frontends often poll it automatically.
         *
         * Refresh/logout do not pass through this middleware.
         */
        if (
            $response->getStatusCode() < 400
            && ! $request->is('api/auth/me')
            && ! $request->routeIs('*.poll')
        ) {
            $this->sessions->recordActivity($sid, (int) $user->user_id);
        }

        return $response;
    }

    private function expired(): Response
    {
        return response()->json([
            'success' => false,
            'message' => 'Authentication session expired. Please sign in again.',
        ], 401)->withCookie($this->cookies->forget());
    }
}