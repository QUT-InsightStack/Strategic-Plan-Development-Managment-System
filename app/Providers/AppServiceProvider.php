<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // ── HTTPS enforcement (existing) ─────────────────────────
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        // ── Rate limiter for login route ─────────────────────────
        // 5 attempts per minute, keyed by email + IP.
        // Prevents brute-force on a single account AND spray from one IP.
        RateLimiter::for('login', function (Request $request) {
            $email = (string) $request->input('email', '');
            return Limit::perMinute(5)->by(
                mb_strtolower($email) . '|' . $request->ip()
            );
        });
    }
}