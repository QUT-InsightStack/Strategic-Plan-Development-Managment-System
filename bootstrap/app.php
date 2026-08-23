<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->redirectGuestsTo(fn (Request $request) => null);

        $middleware->api(prepend: [
            \App\Http\Middleware\JwtCookieMiddleware::class,
        ]);

        $middleware->alias([
            'jwt.auth' => \Tymon\JWTAuth\Middleware\GetUserFromToken::class,
            'jwt.refresh' => \Tymon\JWTAuth\Middleware\RefreshToken::class,
            'permission'  => \App\Http\Middleware\PermissionMiddleware::class,
            'auth.version' => \App\Http\Middleware\ValidateAuthVersion::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->shouldRenderJsonWhen(function (Request $request) {
            return $request->is('api/*') || $request->expectsJson();
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed.',
                    'errors' => $e->errors(),
                ], 422);
            }

            return null;
        });

        $exceptions->render(function (QueryException $e, Request $request) {
            if (! ($request->is('api/*') || $request->expectsJson())) {
                return null;
            }

            if (preg_match('/SPDMS_VALIDATION\|([^|]+)\|(.+?)(?:\s+\(Connection:|$)/', $e->getMessage(), $matches)) {
                $field = $matches[1] !== '' ? $matches[1] : 'database';
                $message = trim($matches[2]);

                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed.',
                    'errors' => [
                        $field => [$message],
                    ],
                ], 422);
            }

            return null;
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated.',
                ], 401);
            }

            return null;
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Too many attempts. Please wait before trying again.',
                ], 429, [
                    'Retry-After' => $e->getHeaders()['Retry-After'] ?? 60,
                    'X-RateLimit-Limit' => $e->getHeaders()['X-RateLimit-Limit'] ?? 5,
                ]);
            }

            return null;
        });
    })
    ->create();
