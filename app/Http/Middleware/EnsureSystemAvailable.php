<?php

namespace App\Http\Middleware;

use App\Services\SystemSettingsService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureSystemAvailable
{
    public function __construct(
        private readonly SystemSettingsService $settings
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->settings->current()->maintenance_enabled) {
            return $next($request);
        }

        $user = Auth::guard('api')->user();

        if (
            $user?->role?->permissions()
                ->where('code', 'settings.manage')
                ->exists()
        ) {
            return $next($request);
        }

        return response()->json([
            'success' => false,
            'message' => 'The system is temporarily unavailable for maintenance.',
        ], 503, [
            'Retry-After' => '60',
        ]);
    }
}