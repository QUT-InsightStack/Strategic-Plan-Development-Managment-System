<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Schedule::command('monitoring:check')->everyMinute()->withoutOverlapping(5)
    ->when(fn (): bool => (bool) config('monitoring.enabled'));
Schedule::command('monitoring:prune')->daily()->withoutOverlapping(60)
    ->when(fn (): bool => (bool) config('monitoring.enabled'));

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
