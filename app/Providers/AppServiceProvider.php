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

        RateLimiter::for('login', function (Request $request): array {
            $input = $request->input('email');
        
            $email = is_string($input)
                ? mb_strtolower(trim($input))
                : '';
        
            return [
                /*
                 * Additional IP-wide protection prevents bypassing the per-identifier
                 * limit by submitting many different email addresses.
                 */
                Limit::perMinute(30)->by(
                    'login-ip:' . $request->ip()
                ),
        
                Limit::perMinute(5)->by(
                    'login-identifier-ip:'
                    . hash('sha256', $email)
                    . '|'
                    . $request->ip()
                ),
            ];
        });
    }
}