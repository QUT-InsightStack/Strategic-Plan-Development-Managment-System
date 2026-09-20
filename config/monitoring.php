<?php

return [
    'enabled' => (bool) env('MONITORING_ENABLED', true),
    'window_minutes' => 15,
    'slow_request_ms' => (int) env('MONITORING_SLOW_REQUEST_MS', 2000),
    'slow_database_ms' => (int) env('MONITORING_SLOW_DATABASE_MS', 500),
    'error_rate_percent' => (float) env('MONITORING_ERROR_RATE_PERCENT', 5),
    'minimum_requests' => (int) env('MONITORING_MINIMUM_REQUESTS', 20),
    'failed_login_threshold' => (int) env('MONITORING_FAILED_LOGIN_THRESHOLD', 10),
    'queue_backlog_threshold' => (int) env('MONITORING_QUEUE_BACKLOG_THRESHOLD', 100),
    'queue_wait_seconds' => (int) env('MONITORING_QUEUE_WAIT_SECONDS', 300),
    'request_retention_days' => (int) env('MONITORING_REQUEST_RETENTION_DAYS', 14),
    'check_retention_days' => (int) env('MONITORING_CHECK_RETENTION_DAYS', 30),
    'event_retention_days' => (int) env('MONITORING_EVENT_RETENTION_DAYS', 90),
    'trend_retention_days' => (int) env('MONITORING_TREND_RETENTION_DAYS', 365),
    'resolved_alert_retention_days' => (int) env('MONITORING_ALERT_RETENTION_DAYS', 365),
    // Zero preserves all records online. Positive values archive, never discard.
    'audit_archive_days' => (int) env('MONITORING_AUDIT_ARCHIVE_DAYS', 0),
    'login_archive_days' => (int) env('MONITORING_LOGIN_ARCHIVE_DAYS', 0),
    'consecutive_login_threshold' => (int) env('MONITORING_CONSECUTIVE_LOGIN_THRESHOLD', 5),
    'mail_enabled' => (bool) env('MONITORING_MAIL_ENABLED', false),
    'mail_to' => array_values(array_filter(array_map('trim', explode(',', (string) env('MONITORING_MAIL_TO', ''))))),
];
