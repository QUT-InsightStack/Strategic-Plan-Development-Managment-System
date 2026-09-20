<?php

namespace Tests\Feature;

use App\Contracts\StrategicLogWriter;
use App\Http\Middleware\ValidateAuthVersion;
use App\Models\Log as AuditLog;
use App\Models\LoginHistory;
use App\Models\Role;
use App\Models\SystemAlert;
use App\Models\SystemCheck;
use App\Models\SystemEvent;
use App\Models\SystemRequest;
use App\Models\User;
use App\Notifications\SystemAlertNotification;
use App\Services\LoginHistoryRecorder;
use App\Services\SystemAlertService;
use App\Services\SystemEventRecorder;
use App\Services\SystemHealthService;
use App\Services\SystemMonitoringService;
use App\Services\SystemTrendService;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class SystemMonitoringTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['app.debug' => false, 'monitoring.enabled' => true]);
    }

    public function test_requests_capture_final_status_database_time_and_safe_route_template(): void
    {
        Route::get('api/monitor-fixture/{record}', function () {
            DB::select('SELECT 1');

            return response()->json(['ok' => true], 409);
        });
        $response = $this->getJson('/api/monitor-fixture/private-value?token=never-store-this')
            ->assertStatus(409)->assertHeader('X-Request-ID');
        $metric = SystemRequest::sole();
        $this->assertSame($response->headers->get('X-Request-ID'), $metric->request_id);
        $this->assertSame('api/monitor-fixture/{record}', $metric->route);
        $this->assertSame(409, $metric->status_code);
        $this->assertGreaterThanOrEqual(1, $metric->db_query_count);
        $this->assertGreaterThanOrEqual(0, $metric->db_duration_ms);
        $this->assertGreaterThanOrEqual($metric->db_duration_ms, $metric->duration_ms + 1);
        $this->assertStringNotContainsString('never-store-this', $metric->toJson());
        $this->assertStringNotContainsString('private-value', $metric->toJson());
    }

    public function test_exceptions_and_unmatched_routes_are_counted_without_exposing_error_details(): void
    {
        Route::get('api/monitor-exception', fn () => throw new \RuntimeException('private diagnostic text'));
        $this->getJson('/api/monitor-exception')->assertStatus(500)->assertHeader('X-Request-ID');
        $metric = SystemRequest::sole();
        $this->assertSame(500, $metric->status_code);
        $this->assertSame(\RuntimeException::class, $metric->exception_type);
        $this->assertStringNotContainsString('private diagnostic text', $metric->toJson());
        $this->getJson('/api/no-such-route/private')->assertNotFound();
        $this->assertSame('<unmatched>', SystemRequest::orderByDesc('id')->first()->route);
    }

    public function test_telemetry_storage_failure_does_not_change_the_business_response(): void
    {
        Schema::drop('tblsystem_requests');
        Log::shouldReceive('channel')->with('stderr')->once()->andReturnSelf();
        Log::shouldReceive('warning')->once();
        Route::get('api/monitor-storage-failure', fn () => response()->json(['ok' => true]));
        $this->getJson('/api/monitor-storage-failure')->assertOk()->assertJsonPath('ok', true);
    }

    public function test_summary_is_windowed_and_monitoring_reads_do_not_inflate_request_counts(): void
    {
        $this->administrator();
        $this->metric(['status_code' => 200, 'duration_ms' => 100, 'db_duration_ms' => 20]);
        $this->metric(['status_code' => 500, 'duration_ms' => 3000, 'db_duration_ms' => 800]);
        $this->metric(['status_code' => 500, 'occurred_at' => now()->subHour()]);
        $this->metric(['status_code' => 500, 'occurred_at' => now()->addHour()]);
        $response = $this->getJson('/api/system-monitoring/summary?minutes=15')->assertOk()
            ->assertJsonPath('data.requests', 2)->assertJsonPath('data.server_errors', 1)
            ->assertJsonPath('data.error_rate_percent', 50)->assertJsonPath('data.slow_requests', 1)
            ->assertJsonPath('data.slow_database_requests', 1)
            ->assertJsonPath('data.average_duration_ms', 1550)
            ->assertJsonPath('data.average_db_duration_ms', 410)
            ->assertJsonPath('scheduler_stale', true);
        $this->assertSame(4, SystemRequest::count());
        $this->getJson('/api/system-monitoring/requests?status_code=500&slow=1')->assertOk()
            ->assertJsonPath('total', 1)->assertJsonPath('data.0.status_code', 500);
        $this->getJson('/api/system-monitoring/requests?request_id='.SystemRequest::first()->request_id)
            ->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/system-monitoring/summary?minutes=0')->assertUnprocessable();
        $this->getJson('/api/system-monitoring/requests?per_page=101')->assertUnprocessable();
    }

    public function test_monitoring_endpoints_require_their_own_permission(): void
    {
        foreach (['summary', 'requests', 'health', 'checks', 'events', 'events/1', 'alerts', 'trends'] as $endpoint) {
            $this->getJson('/api/system-monitoring/'.$endpoint)->assertUnauthorized();
        }
        $this->seed([RolesSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        $user = User::create([
            'first_name' => 'Viewer', 'last_name' => 'Test', 'email' => 'viewer@example.com',
            'password' => 'password', 'status' => 'active',
            'role_id' => Role::where('role_name', 'Viewer')->value('role_id'),
        ]);
        $this->actingAs($user, 'api')->withoutMiddleware(ValidateAuthVersion::class);
        foreach (['summary', 'requests', 'health', 'checks', 'events', 'events/1', 'alerts', 'trends'] as $endpoint) {
            $this->getJson('/api/system-monitoring/'.$endpoint)->assertForbidden();
        }
    }

    public function test_health_checks_real_database_cache_and_storage(): void
    {
        $this->administrator();
        $this->getJson('/api/system-monitoring/health')->assertOk()
            ->assertJsonPath('data.status', 'healthy')
            ->assertJsonPath('data.checks.database.status', 'healthy')
            ->assertJsonPath('data.checks.cache.status', 'healthy')
            ->assertJsonPath('data.checks.storage.status', 'healthy')
            ->assertJsonPath('data.checks.queue.status', 'not_applicable');
        $this->get('/up')->assertOk();
        $this->assertSame(0, SystemRequest::count());
    }

    public function test_database_and_cache_failures_are_not_reported_as_healthy(): void
    {
        $service = app(SystemHealthService::class);
        DB::shouldReceive('select')->with('SELECT 1')->once()->andThrow(new \RuntimeException('db password=private'));
        Cache::shouldReceive('put')->once()->andThrow(new \RuntimeException('cache password=private'));
        Cache::shouldReceive('forget')->once();
        $health = $service->check();
        $this->assertSame('unhealthy', $health['status']);
        $this->assertSame('unhealthy', $health['checks']['database']['status']);
        $this->assertSame('unhealthy', $health['checks']['cache']['status']);
        $this->assertStringNotContainsString('password', json_encode($health));
    }

    public function test_public_up_route_and_private_health_endpoint_signal_dependency_failure(): void
    {
        $this->administrator();
        $this->mock(SystemHealthService::class, function ($mock): void {
            $mock->shouldReceive('check')->twice()->andReturn([
                'status' => 'unhealthy', 'checked_at' => now()->toIso8601String(),
                'checks' => ['database' => ['status' => 'unhealthy']],
            ]);
        });
        $this->get('/up')->assertStatus(500);
        $this->getJson('/api/system-monitoring/health')->assertStatus(503)
            ->assertJsonPath('data.checks.database.status', 'unhealthy');
    }

    public function test_database_queue_detects_ready_backlog_and_recent_failures_but_excludes_delayed_jobs(): void
    {
        config(['queue.default' => 'database']);
        foreach ([now()->timestamp - 600, now()->timestamp + 3600] as $available) {
            DB::table('jobs')->insert([
                'queue' => 'default', 'payload' => '{}', 'attempts' => 0,
                'available_at' => $available, 'created_at' => now()->timestamp - 3600,
            ]);
        }
        DB::table('failed_jobs')->insert([
            'uuid' => Str::uuid(), 'connection' => 'database', 'queue' => 'default',
            'payload' => 'private job body', 'exception' => 'private stack', 'failed_at' => now(),
        ]);
        $queue = app(SystemHealthService::class)->check()['checks']['queue'];
        $this->assertSame('warning', $queue['status']);
        $this->assertSame(2, $queue['total_jobs']);
        $this->assertSame(1, $queue['ready_jobs']);
        $this->assertSame(1, $queue['failed_jobs_in_window']);
        $this->assertGreaterThanOrEqual(600, $queue['oldest_ready_seconds']);
        $this->assertStringNotContainsString('private', json_encode($queue));
    }

    public function test_scheduled_check_detects_issues_deduplicates_log_messages_and_records_recovery(): void
    {
        config(['monitoring.minimum_requests' => 1]);
        $this->metric(['status_code' => 500, 'duration_ms' => 3000, 'db_duration_ms' => 600]);
        Log::shouldReceive('log')->with('warning', 'System monitoring status changed.', \Mockery::type('array'))->once();
        Log::shouldReceive('log')->with('info', 'System monitoring status changed.', \Mockery::type('array'))->once();
        $this->artisan('monitoring:check')->assertExitCode(1);
        $this->artisan('monitoring:check')->assertExitCode(1);
        $check = SystemCheck::orderByDesc('id')->first();
        $this->assertSame('warning', $check->status);
        $this->assertContains('http.high_error_rate', $check->issues);
        $this->assertContains('http.slow_requests', $check->issues);
        $this->assertContains('database.slow_requests', $check->issues);
        $this->travel(16)->minutes();
        $this->artisan('monitoring:check')->assertExitCode(0);
        $this->assertSame('healthy', SystemCheck::orderByDesc('id')->first()->status);
        $this->assertSame(3, SystemCheck::count());
    }

    public function test_check_reports_unavailable_metrics_and_uses_independent_fallback(): void
    {
        Schema::drop('tblsystem_requests');
        Schema::drop('tblsystem_checks');
        Log::shouldReceive('channel')->with('stderr')->once()->andReturnSelf();
        Log::shouldReceive('warning')->once();
        $result = app(SystemMonitoringService::class)->runCheck();
        $this->assertSame('critical', $result['status']);
        $this->assertFalse($result['persisted']);
        $this->assertContains('metrics.unavailable', $result['issues']);
        $this->assertContains('monitoring.storage_unavailable', $result['issues']);
    }

    public function test_retention_prunes_only_expired_operational_records(): void
    {
        $this->metric(['occurred_at' => now()->subDays(15)]);
        $this->metric();
        foreach ([now()->subDays(31), now()] as $time) {
            SystemCheck::create(['status' => 'healthy', 'health' => [], 'metrics' => [], 'issues' => [], 'checked_at' => $time]);
        }
        AuditLog::create(['operation' => 'retained.audit', 'states' => 'success']);
        $this->artisan('monitoring:prune')->assertExitCode(0);
        $this->assertSame(1, SystemRequest::count());
        $this->assertSame(1, SystemCheck::count());
        $this->assertSame(1, AuditLog::count());
    }

    public function test_monitoring_can_be_disabled(): void
    {
        config(['monitoring.enabled' => false]);
        $this->getJson('/api/no-such-route')->assertNotFound();
        $this->artisan('monitoring:check')->assertExitCode(0);
        $this->assertSame(0, SystemRequest::count());
        $this->assertSame(0, SystemCheck::count());
    }

    public function test_events_capture_http_exceptions_and_filter_and_paginate_without_sensitive_context(): void
    {
        Route::get('api/event-error/{id}', fn () => throw new \RuntimeException('private exception text'));
        $response = $this->getJson('/api/event-error/secret?token=hidden')->assertStatus(500);
        $event = SystemEvent::sole();
        $this->assertSame('http.error', $event->event);
        $this->assertSame($response->headers->get('X-Request-ID'), $event->request_id);
        $this->assertSame(500, $event->context['status_code']);
        $this->assertSame(\RuntimeException::class, $event->context['exception_type']);
        $this->assertStringNotContainsString('private exception text', $event->toJson());
        $this->assertStringNotContainsString('secret', $event->toJson());
        app(SystemEventRecorder::class)->record('backup.failed', 'backup', 'error', 'failure', ['password' => 'hidden']);
        $this->administrator();
        $this->getJson('/api/system-monitoring/events?severity=error&source=http&outcome=failure&status_code=500&per_page=1')
            ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.request_id', $event->request_id);
        $this->getJson('/api/system-monitoring/events?request_id='.$event->request_id)->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/system-monitoring/events/'.$event->id)->assertOk()->assertJsonPath('data.event', 'http.error');
        $this->getJson('/api/system-monitoring/events/999999')->assertNotFound();
        $this->getJson('/api/system-monitoring/events?severity=invalid')->assertUnprocessable();
        $this->getJson('/api/system-monitoring/events?from=2026-09-08&to=2026-09-07')->assertUnprocessable();
        $this->getJson('/api/system-monitoring/events?from=2000-01-01&to=2000-01-02')->assertOk()->assertJsonPath('total', 0);
        $this->assertStringNotContainsString('password', SystemEvent::where('source', 'backup')->sole()->toJson());
    }

    public function test_login_failure_reasons_produce_correlated_events(): void
    {
        $requestId = (string) Str::uuid();
        request()->attributes->set('monitoring', ['request_id' => $requestId, 'db_duration_ms' => 0, 'db_query_count' => 0]);
        foreach (['invalid_credentials', 'account_locked', 'rate_limited'] as $reason) {
            app(LoginHistoryRecorder::class)->recordFailedLogin('private@example.com', request(), $reason);
        }
        request()->attributes->remove('monitoring');
        $this->assertSame(['auth.login_failed', 'auth.account_locked', 'auth.rate_limited'], SystemEvent::orderBy('id')->pluck('event')->all());
        $this->assertSame(3, SystemEvent::where('request_id', $requestId)->count());
        $this->assertSame('rate_limited', SystemEvent::latest('id')->first()->context['reason']);
        $this->assertStringNotContainsString('private@example.com', SystemEvent::all()->toJson());
    }

    public function test_writer_attributes_explicit_actor_and_backup_failures_consistently(): void
    {
        $this->administrator();
        $other = User::create(['first_name' => 'Other', 'last_name' => 'Actor', 'email' => 'other@example.com',
            'password' => 'password', 'status' => 'active', 'role_id' => Role::first()->role_id]);
        $requestId = (string) Str::uuid();
        request()->attributes->set('monitoring', ['request_id' => $requestId, 'db_duration_ms' => 0, 'db_query_count' => 0]);
        app(StrategicLogWriter::class)->write('backup.failed', [
            'actor_user_id' => $other->user_id, 'resource_type' => 'backup', 'resource_id' => 99, 'states' => 'failed',
        ]);
        request()->attributes->remove('monitoring');
        $audit = AuditLog::sole();
        $this->assertSame($other->user_id, $audit->user_id);
        $this->assertSame('Other Actor', $audit->actor_name);
        $this->assertSame('failure', $audit->outcome);
        $this->assertSame($requestId, $audit->metadata['request_id']);
        $this->assertSame('failure', SystemEvent::sole()->outcome);
        $this->assertSame('error', SystemEvent::sole()->severity);
        app(StrategicLogWriter::class)->write('system.test', ['actor_user_id' => null]);
        $this->assertNull(AuditLog::latest('log_id')->first()->user_id);
        $this->assertNull(AuditLog::latest('log_id')->first()->actor_name);
    }

    public function test_alerts_deduplicate_recover_reopen_and_notify_once_per_transition(): void
    {
        Notification::fake();
        config(['monitoring.mail_enabled' => true, 'monitoring.mail_to' => ['monitor@example.com']]);
        $service = app(SystemAlertService::class);
        $service->reconcile(['backup.failed'], true);
        $service->reconcile(['backup.failed'], true);
        $this->assertSame(2, SystemAlert::sole()->occurrences);
        $this->assertSame(1, SystemEvent::where('event', 'alert.opened')->count());
        Notification::assertCount(1);
        $service->reconcile([], false);
        $this->assertSame('open', SystemAlert::sole()->status);
        $service->reconcile([], true);
        $service->reconcile([], true);
        $alert = SystemAlert::sole();
        $this->assertSame('resolved', $alert->status);
        $this->assertNotNull($alert->resolved_at);
        $this->assertNull($alert->active_key);
        Notification::assertCount(2);
        Notification::assertSentOnDemand(SystemAlertNotification::class,
            fn ($notification, $channels, $notifiable) => $notification->recovered && $notifiable->routes['mail'] === ['monitor@example.com']);
        $service->reconcile(['backup.failed'], true);
        $this->assertSame(2, SystemAlert::count());
        Notification::assertCount(3);
        $this->administrator();
        $this->getJson('/api/system-monitoring/alerts?status=open')->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/system-monitoring/alerts?status=resolved')->assertOk()->assertJsonPath('total', 1);
    }

    public function test_notification_failure_does_not_lose_alert_and_next_check_retries(): void
    {
        config(['monitoring.mail_enabled' => true, 'monitoring.mail_to' => ['monitor@example.com']]);
        Notification::shouldReceive('send')->once()->andThrow(new \RuntimeException('mail unavailable'));
        $service = app(SystemAlertService::class);
        $service->reconcile(['backup.failed'], true);
        $this->assertSame('open', SystemAlert::sole()->status);
        $this->assertNull(SystemAlert::sole()->opening_notified_at);
        $this->assertDatabaseHas('tblsystem_events', ['event' => 'monitoring.notification_failed']);
        Notification::fake();
        $service->reconcile(['backup.failed'], true);
        Notification::assertCount(1);
        $this->assertNotNull(SystemAlert::sole()->opening_notified_at);
    }

    public function test_detector_distinguishes_consecutive_failures_from_failures_followed_by_success(): void
    {
        config(['monitoring.consecutive_login_threshold' => 2]);
        $recorder = app(LoginHistoryRecorder::class);
        $recorder->recordFailedLogin('attempt@example.com', request());
        $recorder->recordFailedLogin('attempt@example.com', request());
        $this->assertContains('auth.consecutive_failures', app(SystemMonitoringService::class)->runCheck()['issues']);
        DB::table('tbllogin_history')->insert(['email' => 'attempt@example.com', 'status' => 'success', 'attempted_at' => now()]);
        $this->assertNotContains('auth.consecutive_failures', app(SystemMonitoringService::class)->runCheck()['issues']);
        $this->assertDatabaseHas('tblsystem_alerts', ['condition' => 'auth.consecutive_failures', 'status' => 'resolved']);
    }

    public function test_hourly_trends_are_idempotent_and_survive_raw_retention(): void
    {
        $hour = now()->subDays(15)->startOfHour();
        $this->metric(['occurred_at' => $hour, 'status_code' => 500, 'duration_ms' => 300]);
        $this->metric(['occurred_at' => $hour->copy()->addMinute(), 'duration_ms' => 100]);
        $this->artisan('monitoring:prune')->assertExitCode(0);
        $this->assertSame(0, SystemRequest::count());
        $bucket = DB::table('tblsystem_metrics')->sole();
        $this->assertSame(2, $bucket->requests);
        $this->assertSame(1, $bucket->server_errors);
        $this->assertEquals(400, $bucket->duration_ms);
        app(SystemTrendService::class)->aggregateHour($hour);
        $this->assertSame(2, DB::table('tblsystem_metrics')->sole()->requests);
        $this->administrator();
        $this->getJson('/api/system-monitoring/trends?'.http_build_query(['from' => $hour->toDateTimeString(), 'to' => $hour->copy()->addHour()->toDateTimeString()]))
            ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.requests', 2);
    }

    public function test_archiving_preserves_raw_legacy_records_in_batches_and_can_be_repeated(): void
    {
        config(['monitoring.audit_archive_days' => 365, 'monitoring.login_archive_days' => 180]);
        $old = now()->subDays(400);
        $legacy = json_encode(['event' => 'backup.failed', 'backup_id' => 5]);
        $rows = array_fill(0, 501, ['operation' => $legacy, 'states' => 'failed', 'outcome' => 'success', 'created_at' => $old, 'updated_at' => $old]);
        foreach (array_chunk($rows, 100) as $chunk) {
            DB::table('tbllog')->insert($chunk);
        }
        DB::table('tbllogin_history')->insert(['email' => 'historic@example.com', 'status' => 'failed', 'failure_reason' => 'account_locked', 'attempted_at' => $old]);
        AuditLog::create(['operation' => 'current.audit', 'states' => 'success']);
        $this->artisan('monitoring:archive')->assertExitCode(0);
        $this->artisan('monitoring:archive')->assertExitCode(0);
        $this->assertSame(502, DB::table('tblaudit_archives')->count());
        $this->assertSame(1, AuditLog::count());
        $archived = json_decode(DB::table('tblaudit_archives')->where('source', 'tbllog')->first()->record, true);
        $this->assertSame($legacy, $archived['operation']);
        $this->assertSame('success', $archived['outcome']);
        $this->assertSame('failed', $archived['states']);
        $this->assertSame(0, LoginHistory::count());
    }

    public function test_archive_conflict_rolls_back_entire_batch_and_preserves_original_records(): void
    {
        config(['monitoring.audit_archive_days' => 1]);
        $old = now()->subDays(3);
        $id = DB::table('tbllog')->insertGetId(['operation' => 'old.audit', 'created_at' => $old, 'updated_at' => $old], 'log_id');
        DB::table('tblaudit_archives')->insert(['source' => 'tbllog', 'original_id' => $id, 'record' => '{}', 'occurred_at' => $old, 'archived_at' => now()]);
        try {
            Artisan::call('monitoring:archive');
            $this->fail('Conflicting archive must fail.');
        } catch (QueryException) {
            $this->assertSame(1, AuditLog::count());
            $this->assertSame(1, DB::table('tblaudit_archives')->count());
        }
    }

    public function test_query_plans_use_time_indexes_for_events_and_audits(): void
    {
        foreach ([['severity', 'error', 'system_events_severity_time'], ['source', 'http', 'system_events_source_time']] as [$field, $value, $index]) {
            $plan = DB::select("EXPLAIN QUERY PLAN SELECT * FROM tblsystem_events WHERE $field = ? AND occurred_at >= ? AND occurred_at <= ? ORDER BY occurred_at DESC, id DESC LIMIT 25", [$value, now()->subHour(), now()]);
            $this->assertStringContainsString($index, json_encode($plan));
            $this->assertStringNotContainsString('USE TEMP B-TREE', json_encode($plan));
        }
        $plan = DB::select('EXPLAIN QUERY PLAN SELECT * FROM tbllog WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC, log_id DESC LIMIT 25', [now()->subHour(), now()]);
        $this->assertStringContainsString('tbllog_created_log_idx', json_encode($plan));
        $this->artisan('monitoring:explain')->assertExitCode(0);
    }

    public function test_a_partially_completed_prune_cannot_overwrite_finalized_trends(): void
    {
        $hour = now()->subDays(15)->startOfHour();
        $first = $this->metric(['occurred_at' => $hour]);
        $this->metric(['occurred_at' => $hour]);
        app(SystemTrendService::class)->aggregateBefore($hour->copy()->addHour());
        DB::table('tblsystem_requests')->where('id', $first->id)->delete();
        $this->artisan('monitoring:prune')->assertExitCode(0);
        $this->assertSame(2, DB::table('tblsystem_metrics')->sole()->requests);
        $this->assertTrue((bool) DB::table('tblsystem_metrics')->sole()->finalized);
    }

    public function test_failed_queue_jobs_emit_safe_events(): void
    {
        $job = \Mockery::mock(Job::class);
        event(new JobFailed('database', $job, new \RuntimeException('private job failure')));
        $event = SystemEvent::sole();
        $this->assertSame('queue.job_failed', $event->event);
        $this->assertSame('failure', $event->outcome);
        $this->assertSame(\RuntimeException::class, $event->context['exception_type']);
        $this->assertStringNotContainsString('private job failure', $event->toJson());
    }

    public function test_storage_round_trip_failure_is_unhealthy(): void
    {
        Storage::shouldReceive('disk')->once()->andReturnSelf();
        Storage::shouldReceive('put')->once()->andReturn(false);
        Storage::shouldReceive('delete')->once();
        $this->assertSame('unhealthy', app(SystemHealthService::class)->check()['checks']['storage']['status']);
    }

    public function test_expired_events_and_resolved_alerts_are_pruned_but_open_alerts_are_kept(): void
    {
        Notification::fake();
        app(SystemAlertService::class)->reconcile(['backup.failed'], true);
        $this->assertSame('open', SystemAlert::sole()->status);
        $old = now()->subDays(400);
        SystemAlert::sole()->update(['opened_at' => $old, 'last_seen_at' => $old]);
        SystemAlert::create(['condition' => 'http.high_error_rate', 'active_key' => null, 'severity' => 'warning',
            'status' => 'resolved', 'opened_at' => $old, 'last_seen_at' => $old, 'resolved_at' => $old]);
        SystemEvent::query()->update(['occurred_at' => $old]);
        $this->artisan('monitoring:prune')->assertExitCode(0);
        $this->assertSame('open', SystemAlert::sole()->status);
        $this->assertSame(0, SystemEvent::count());
        Notification::assertNothingSent();
    }

    public function test_summary_and_requests_honor_explicit_time_boundaries(): void
    {
        $this->administrator();
        $start = now()->subHours(2)->startOfMinute();
        $this->metric(['occurred_at' => $start, 'status_code' => 500]);
        $this->metric(['occurred_at' => $start->copy()->subSecond()]);
        $this->metric();
        $query = http_build_query(['from' => $start->copy()->setTimezone('Australia/Brisbane')->toIso8601String(),
            'to' => $start->copy()->addMinute()->setTimezone('Australia/Brisbane')->toIso8601String()]);
        $this->getJson('/api/system-monitoring/summary?'.$query)->assertOk()
            ->assertJsonPath('data.requests', 1)->assertJsonPath('data.error_rate_percent', 100);
        $this->getJson('/api/system-monitoring/requests?'.$query)->assertOk()->assertJsonPath('total', 1);
    }

    private function metric(array $attributes = []): SystemRequest
    {
        return SystemRequest::create([
            'request_id' => Str::uuid(), 'route' => 'api/example', 'method' => 'GET',
            'status_code' => 200, 'duration_ms' => 100, 'db_duration_ms' => 10,
            'db_query_count' => 1, 'occurred_at' => now(), ...$attributes,
        ]);
    }

    private function administrator(): void
    {
        $this->seed([RolesSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class]);
        $actor = User::create([
            'first_name' => 'Monitor', 'last_name' => 'Admin', 'email' => 'monitor@example.com',
            'password' => 'password', 'status' => 'active',
            'role_id' => Role::where('role_name', 'Technical Administrator')->value('role_id'),
        ]);
        $this->actingAs($actor, 'api')->withoutMiddleware(ValidateAuthVersion::class);
    }
}
