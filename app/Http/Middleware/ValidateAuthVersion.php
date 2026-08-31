<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;
use Tymon\JWTAuth\Exceptions\JWTException;
use Tymon\JWTAuth\Facades\JWTAuth;

class ValidateAuthVersion
{
    public function handle(
        Request $request,
        Closure $next
    ): Response {
        $user = Auth::guard('api')->user();

        if (! $user) {
            return new JsonResponse([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        if ($user->status !== 'active') {
            return new JsonResponse([
                'success' => false,
                'message' => 'Authentication session expired.',
            ], 401);
        }

        try {
            $payload = JWTAuth::parseToken()->getPayload();
        } catch (JWTException) {
            return new JsonResponse([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $tokenVersion = (int) $payload->get('auth_version');
        $currentVersion = (int) $user->auth_version;

        if (
            $tokenVersion < 1
            || $tokenVersion !== $currentVersion
        ) {
            return new JsonResponse([
                'success' => false,
                'message' => 'Authentication session expired.',
            ], 401);
        }

        return $next($request);
    }
}
