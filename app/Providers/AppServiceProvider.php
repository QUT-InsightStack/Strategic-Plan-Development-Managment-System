<?php

namespace App\Providers;

use App\Contracts\StrategicLogWriter;
use App\Services\StrategicAuditLogWriter;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(
            StrategicLogWriter::class,
            StrategicAuditLogWriter::class
        );
    }

    public function boot(): void
    {
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        RateLimiter::for('login', function (Request $request) {
            $email = (string) $request->input('email', '');

            return Limit::perMinute(5)->by(
                mb_strtolower($email) . '|' . $request->ip()
            );
        });
    }
}