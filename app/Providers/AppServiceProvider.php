<?php

namespace App\Providers;

use App\Contracts\StrategicLogWriter;
use App\Services\StrategicAuditLogWriter;
use App\Services\SystemHealthService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Foundation\Events\DiagnosingHealth;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
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
        DB::listen(function (QueryExecuted $event): void {
            $request = $this->app->bound('request') ? $this->app->make('request') : null;
            $metrics = $request?->attributes->get('monitoring');
            if (is_array($metrics)) {
                $metrics['db_duration_ms'] += $event->time;
                $metrics['db_query_count']++;
                $request->attributes->set('monitoring', $metrics);
            }
        });

        Event::listen(\Illuminate\Queue\Events\JobFailed::class, function ($event): void {
            app(\App\Services\SystemEventRecorder::class)->record('queue.job_failed', 'queue', 'error', 'failure', [
                'exception_type' => $event->exception::class,
            ]);
        });

        Event::listen(DiagnosingHealth::class, function (): void {
            if (config('monitoring.enabled') && app(SystemHealthService::class)->check()['status'] === 'unhealthy') {
                throw new \RuntimeException('A system dependency requires attention.');
            }
        });

        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        RateLimiter::for('login', function (Request $request) {
            $input = $request->input('email', '');
            $email = is_string($input) ? trim($input) : '';

            return Limit::perMinute(5)->by(
                mb_strtolower($email) . '|' . $request->ip()
            );
        });
    }
}
