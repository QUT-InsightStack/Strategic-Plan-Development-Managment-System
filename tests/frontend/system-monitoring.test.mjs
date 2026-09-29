import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    componentRows,
    formatMs,
    formatPercent,
    issueLabel,
    overallStatus,
    pageMeta,
    summaryTiles,
    trendSeries,
    trendTotals,
} from '../../resources/js/data/system-monitoring-data.js';

test('issue codes get readable labels, including component health codes', () => {
    assert.equal(issueLabel('http.high_error_rate'), 'High server error rate');
    assert.equal(issueLabel('queue.warning'), 'Job queue needs attention');
    assert.equal(issueLabel('database.unhealthy'), 'Database is not responding');
    assert.equal(issueLabel('custom.thing_happened'), 'Custom thing happened');
});

test('overall status takes the worst signal and flags a stale scheduler', () => {
    assert.equal(overallStatus({ health: { status: 'healthy' }, latestCheck: { status: 'healthy', issues: [] } }).status, 'healthy');
    assert.equal(overallStatus({ health: { status: 'unhealthy' }, latestCheck: { status: 'warning', issues: [] } }).status, 'critical');

    const stale = overallStatus({ health: { status: 'healthy' }, latestCheck: null, schedulerStale: true });
    assert.equal(stale.status, 'warning');
    assert.match(stale.reasons[0], /have not run/);

    const issues = overallStatus({ health: { status: 'healthy' }, latestCheck: { status: 'warning', issues: ['backup.failed'] } });
    assert.deepEqual(issues, { status: 'warning', reasons: ['Backup failed.'] });
});

test('summary tiles use the server thresholds to decide tone', () => {
    const tiles = summaryTiles({
        requests: 120, server_errors: 3, client_errors: 0, error_rate_percent: 2.5, slow_requests: 0, slow_database_requests: 0,
        average_duration_ms: 180, max_duration_ms: 2500, average_db_duration_ms: 12, db_queries: 900, failed_logins: 0, failed_backups: 0,
        thresholds: { slow_request_ms: 2000, slow_database_ms: 500 },
    });
    const byKey = Object.fromEntries(tiles.map((tile) => [tile.key, tile]));
    assert.equal(byKey.error_rate.tone, 'danger');
    assert.equal(byKey.error_rate.value, '2.50%');
    assert.equal(byKey.response.tone, 'warning');
    assert.equal(byKey.client_errors.tone, 'success');
    assert.equal(summaryTiles(null).length, 0);
});

test('trend series is oldest-first and averages from duration sums', () => {
    const series = trendSeries([
        { bucket_at: '2026-09-30T02:00:00Z', requests: 10, server_errors: 1, client_errors: 2, duration_ms: 1000, max_duration_ms: 400 },
        { bucket_at: '2026-09-30T01:00:00Z', requests: 0, server_errors: 0, client_errors: 0, duration_ms: 0, max_duration_ms: 0 },
        { bucket_at: '2026-09-30T00:00:00Z', requests: 30, server_errors: 0, client_errors: 0, duration_ms: 6000, max_duration_ms: 900 },
    ]);
    assert.deepEqual(series.map((point) => point.bucketAt), ['2026-09-30T00:00:00Z', '2026-09-30T01:00:00Z', '2026-09-30T02:00:00Z']);
    assert.equal(series[2].averageMs, 100);
    assert.equal(series[2].errorRate, 10);
    assert.equal(series[1].averageMs, 0);

    const totals = trendTotals(series);
    assert.equal(totals.requests, 40);
    assert.equal(totals.averageMs, 175);
    assert.equal(totals.errorRate, 2.5);
    assert.equal(totals.peak.requests, 30);
});

test('health components are listed in a stable order with their details', () => {
    const rows = componentRows({ checks: {
        queue: { status: 'warning', driver: 'database', queue: 'default', ready_jobs: 150, total_jobs: 160, oldest_ready_seconds: 600, failed_jobs_in_window: 0, duration_ms: 3 },
        database: { status: 'healthy', duration_ms: 1.2 },
    } });
    assert.deepEqual(rows.map((row) => row.key), ['database', 'queue']);
    assert.deepEqual(rows[1].facts.find(([label]) => label === 'Oldest waiting'), ['Oldest waiting', '10 min']);
});

test('formatting helpers', () => {
    assert.equal(formatMs(250.4), '250 ms');
    assert.equal(formatMs(2500), '2.5 s');
    assert.equal(formatMs(null), '—');
    assert.equal(formatPercent(0), '0%');
    assert.deepEqual(pageMeta({ current_page: 2, last_page: 5, total: 70 }), { page: 2, lastPage: 5, total: 70, from: null, to: null });
});
