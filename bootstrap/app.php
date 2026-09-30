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
        $middleware->prepend(\App\Http\Middleware\MonitorSystemActivity::class);
        $middleware->redirectGuestsTo(fn (Request $request) => null);

        $middleware->encryptCookies(except: [
            'access_token',
        ]);

        $middleware->trimStrings(except: [
            'password',
            'password_confirmation',
            'current_password',
            'new_password',
            'new_password_confirmation',
        ]);
    
        $middleware->api(prepend: [
            \App\Http\Middleware\EnsureTrustedApiOrigin::class,
            \App\Http\Middleware\JwtCookieMiddleware::class,
        ]);

        $middleware->alias([
            'jwt.auth' => \Tymon\JWTAuth\Middleware\GetUserFromToken::class,
            'jwt.refresh' => \Tymon\JWTAuth\Middleware\RefreshToken::class,
            'permission'  => \App\Http\Middleware\PermissionMiddleware::class,
            'auth.version' => \App\Http\Middleware\ValidateAuthVersion::class,
            'auth.session' => \App\Http\Middleware\ValidateAuthSession::class,
            'system.available' => \App\Http\Middleware\EnsureSystemAvailable::class,
        ]);

        
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->report(function (\Throwable $exception): void {
            if (app()->bound('request') && request()->attributes->has('monitoring')) {
                request()->attributes->set('monitoring_exception_type', $exception::class);
            } else {
                app(\App\Services\SystemEventRecorder::class)->record('application.exception', 'application', 'error', 'failure', [
                    'exception_type' => $exception::class,
                ]);
            }
        });
        $exceptions->context(function (): array {
            $metrics = app()->bound('request') ? request()->attributes->get('monitoring') : null;

            return is_array($metrics) ? ['request_id' => $metrics['request_id']] : [];
        });

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
            if ($request->isMethod('post') && $request->is('api/auth/login')
                && ! $request->attributes->get('login_rate_limit_recorded')) {
                $request->attributes->set('login_rate_limit_recorded', true);
                $email = $request->input('email');
                try {
                    app(\App\Services\LoginHistoryRecorder::class)->recordFailedLogin(
                        is_string($email) ? $email : '', $request, 'rate_limited'
                    );
                } catch (\Throwable) {
                    // Preserve the 429 response even when the history database is unavailable.
                    error_log('Unable to record a rate-limited login attempt.');
                }
            }

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
