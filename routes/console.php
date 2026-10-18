<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;

Schedule::command('workflow:deliver-notifications')->everyMinute()->withoutOverlapping(5);

Schedule::command('monitoring:check')->everyMinute()->withoutOverlapping(5)
    ->when(fn (): bool => (bool) config('monitoring.enabled'));
Schedule::command('monitoring:prune')->daily()->withoutOverlapping(60)
    ->when(fn (): bool => (bool) config('monitoring.enabled'));



Schedule::call(function (): void {
    /*
     * Session records are operational state, not audit history.
     */
    DB::table('tblauth_sessions')
        ->where('expires_at', '<', now()->subDays(7))
        ->delete();


    /*
     * No live lockout can last this long. Avoid unbounded identifier growth.
     */
    DB::table('tbllogin_attempt_states')
        ->where('updated_at', '<', now()->subDays(7))
        ->delete();
})
    ->name('cleanup-authentication-state')
    ->daily()
    ->withoutOverlapping();


Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
