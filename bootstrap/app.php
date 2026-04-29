<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web:      __DIR__ . '/../routes/web.php',
        api:      __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health:   '/up',
    )

    // ── Middleware ────────────────────────────────────────────────
    ->withMiddleware(function (Middleware $middleware) {


         // Never redirect guests — no server-side login page.
        // Returning null forces AuthenticationException to be thrown
        // (without a redirect URL), which our exception handler catches below.
        $middleware->redirectGuestsTo(fn (Request $request) => null);


        // Prepend cookie→header bridge to every API request
        // so jwt-auth can read the token from the HttpOnly cookie.
        $middleware->api(prepend: [
            \App\Http\Middleware\JwtCookieMiddleware::class,
        ]);
    })

    // ── Exception Handling ───────────────────────────────────────
    ->withExceptions(function (Exceptions $exceptions) {

        // never redirect on 401 — always return JSON.
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            // Trigger for any request that hits api/* OR expects JSON
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated.',
                ], 401);
            }
        });

        // JSON 429 for rate limiting — replaces Laravel's default HTML page
        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Too many attempts. Please wait before trying again.',
                ], 429, [
                    'Retry-After'       => $e->getHeaders()['Retry-After']       ?? 60,
                    'X-RateLimit-Limit' => $e->getHeaders()['X-RateLimit-Limit'] ?? 5,
                ]);
            }
        });

    })

    ->create();

