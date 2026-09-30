<?php

namespace App\Http\Middleware;

use App\Services\SystemMonitoringService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class MonitorSystemActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('monitoring.enabled') || ! $request->is('api/*')
            || $request->is('api/system-monitoring', 'api/system-monitoring/*')) {
            return $next($request);
        }

        $request->attributes->set('monitoring', [
            'request_id' => (string) Str::uuid(),
            'occurred_at' => now(),
            'db_duration_ms' => 0.0,
            'db_query_count' => 0,
        ]);
        $started = hrtime(true);

        try {
            $response = $next($request);
            $response->headers->set('X-Request-ID', $request->attributes->get('monitoring')['request_id']);

            return $response;
        } finally {
            $metrics = $request->attributes->get('monitoring');
            $metrics['duration_ms'] = round((hrtime(true) - $started) / 1e6, 2);
            $request->attributes->set('monitoring', $metrics);
        }
    }

    public function terminate(Request $request, Response $response): void
    {
        $metrics = $request->attributes->get('monitoring');
        if (! is_array($metrics)) {
            return;
        }

        // Capture the final rendered status, including 401/403/429 and exceptions.
        // Remove the context first so the telemetry INSERT is not measured itself.
        $request->attributes->remove('monitoring');
        app(SystemMonitoringService::class)->recordRequest([
            ...$metrics,
            'route' => mb_substr($request->route()?->uri() ?? '<unmatched>', 0, 255),
            'method' => mb_substr($request->method(), 0, 16),
            'status_code' => $response->getStatusCode(),
            'exception_type' => $request->attributes->get('monitoring_exception_type'),
        ]);
    }
}
