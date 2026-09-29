/*
 * Presentation helpers for the System Activity page.
 *
 * Pure functions over the monitoring API responses, kept separate from the
 * page so they can be tested without a browser.
 */

export const WINDOW_OPTIONS = Object.freeze([
    { minutes: 15, label: 'Last 15 minutes' },
    { minutes: 60, label: 'Last hour' },
    { minutes: 360, label: 'Last 6 hours' },
    { minutes: 1440, label: 'Last 24 hours' },
]);

export const AUTO_REFRESH_SECONDS = 30;

export const STATUS_LABELS = Object.freeze({
    healthy: 'Healthy',
    warning: 'Warning',
    unhealthy: 'Unhealthy',
    critical: 'Critical',
    not_applicable: 'Not applicable',
    unsupported: 'Unsupported',
    unknown: 'Unknown',
});

export const STATUS_TONES = Object.freeze({
    healthy: 'success',
    warning: 'warning',
    unsupported: 'warning',
    unhealthy: 'danger',
    critical: 'danger',
    not_applicable: 'neutral',
    unknown: 'neutral',
});

export const STATUS_ICONS = Object.freeze({
    healthy: 'bi-check-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    unsupported: 'bi-exclamation-triangle-fill',
    unhealthy: 'bi-x-octagon-fill',
    critical: 'bi-x-octagon-fill',
    not_applicable: 'bi-dash-circle',
    unknown: 'bi-question-circle',
});

export const SEVERITY_TONES = Object.freeze({ info: 'info', warning: 'warning', error: 'danger', critical: 'danger' });
export const SEVERITY_LABELS = Object.freeze({ info: 'Info', warning: 'Warning', error: 'Error', critical: 'Critical' });
export const OUTCOME_TONES = Object.freeze({ success: 'success', failure: 'danger', denied: 'warning' });
export const OUTCOME_LABELS = Object.freeze({ success: 'Success', failure: 'Failure', denied: 'Denied' });

export const COMPONENT_LABELS = Object.freeze({
    database: 'Database',
    cache: 'Cache',
    storage: 'File storage',
    queue: 'Job queue',
});

export const ISSUE_LABELS = Object.freeze({
    'http.high_error_rate': 'High server error rate',
    'http.slow_requests': 'Slow requests detected',
    'database.slow_requests': 'Slow database activity',
    'auth.repeated_failures': 'Repeated failed sign-ins',
    'auth.consecutive_failures': 'Consecutive failed sign-ins for one account',
    'backup.failed': 'Backup failed',
    'metrics.unavailable': 'Request metrics unavailable',
    'monitoring.storage_unavailable': 'Monitoring data could not be saved',
    'monitoring.processing_failed': 'Alert or trend processing failed',
});

const COMPONENT_STATUS_WORDING = Object.freeze({
    unhealthy: 'is not responding',
    warning: 'needs attention',
    unsupported: 'uses an unsupported driver',
});

/** Human wording for a detected issue code such as `queue.warning`. */
export function issueLabel(code) {
    if (ISSUE_LABELS[code]) return ISSUE_LABELS[code];
    const [component, status] = String(code || '').split('.');
    if (COMPONENT_LABELS[component] && COMPONENT_STATUS_WORDING[status]) {
        return `${COMPONENT_LABELS[component]} ${COMPONENT_STATUS_WORDING[status]}`;
    }
    return humanise(code);
}

/** `http.slow_request` -> `Http slow request`; used when no specific label exists. */
export function humanise(code) {
    const text = String(code || '').replace(/[._]+/g, ' ').trim()
        .replace(/\b(http|api|db)\b/gi, (word) => word.toUpperCase());
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '—';
}

export function statusLabel(status) {
    return STATUS_LABELS[status] || humanise(status);
}

export function statusTone(status) {
    return STATUS_TONES[status] || 'neutral';
}

/**
 * One overall state for the banner.
 *
 * A live health check is the most current signal; the latest scheduled check
 * adds detected issues such as error rates. A stale scheduler means detection
 * is not running, which is itself a warning even when dependencies are fine.
 */
export function overallStatus({ health, latestCheck, schedulerStale, collectionEnabled = true } = {}) {
    const rank = { healthy: 0, warning: 1, unhealthy: 2, critical: 2 };
    const candidates = [health?.status, latestCheck?.status].filter((status) => status in rank);
    let status = candidates.sort((a, b) => rank[b] - rank[a])[0] || 'unknown';
    const reasons = [];

    if (health?.status === 'unhealthy') reasons.push('A system dependency is not responding.');
    (latestCheck?.issues || []).forEach((issue) => reasons.push(`${issueLabel(issue)}.`));
    if (schedulerStale) {
        reasons.push('Scheduled monitoring checks have not run in the last 3 minutes.');
        if (status === 'healthy' || status === 'unknown') status = 'warning';
    }
    if (!collectionEnabled) {
        reasons.push('Request monitoring is turned off on this server.');
        if (status === 'healthy' || status === 'unknown') status = 'warning';
    }

    return { status: status === 'unhealthy' ? 'critical' : status, reasons: [...new Set(reasons)] };
}

function toNumber(value) {
    return value === null || value === undefined || value === '' ? NaN : Number(value);
}

export function formatNumber(value) {
    const number = toNumber(value);
    return Number.isFinite(number) ? number.toLocaleString() : '—';
}

export function formatMs(value) {
    const number = toNumber(value);
    if (!Number.isFinite(number)) return '—';
    if (number >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)} s`;
    return `${Math.round(number)} ms`;
}

export function formatPercent(value) {
    const number = toNumber(value);
    return Number.isFinite(number) ? `${Number.isInteger(number) ? number : number.toFixed(2)}%` : '—';
}

export function formatSeconds(value) {
    const seconds = toNumber(value);
    if (!Number.isFinite(seconds)) return '—';
    if (seconds < 60) return `${Math.round(seconds)} s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    return `${(seconds / 3600).toFixed(1)} h`;
}

export function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatRelative(value, now = Date.now()) {
    const time = value ? new Date(value).getTime() : NaN;
    if (Number.isNaN(time)) return '—';
    const seconds = Math.max(0, Math.round((now - time) / 1000));
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
    return `${Math.floor(seconds / 86400)} d ago`;
}

/**
 * Key figures for the selected window. Tones compare against the thresholds
 * the server reports, so the page never hardcodes what "slow" means.
 */
export function summaryTiles(summary) {
    if (!summary) return [];
    const thresholds = summary.thresholds || {};

    return [
        { key: 'requests', label: 'API requests', value: formatNumber(summary.requests), detail: `${formatNumber(summary.db_queries)} database queries`, icon: 'bi-activity', tone: 'primary' },
        { key: 'error_rate', label: 'Server error rate', value: formatPercent(summary.error_rate_percent), detail: `${formatNumber(summary.server_errors)} server errors (5xx)`, icon: 'bi-bug', tone: summary.server_errors > 0 ? 'danger' : 'success' },
        { key: 'client_errors', label: 'Client errors', value: formatNumber(summary.client_errors), detail: 'Rejected requests (4xx)', icon: 'bi-slash-circle', tone: summary.client_errors > 0 ? 'warning' : 'success' },
        { key: 'response', label: 'Average response', value: formatMs(summary.average_duration_ms), detail: `Slowest ${formatMs(summary.max_duration_ms)}`, icon: 'bi-stopwatch', tone: thresholds.slow_request_ms && summary.max_duration_ms >= thresholds.slow_request_ms ? 'warning' : 'info' },
        { key: 'slow', label: 'Slow requests', value: formatNumber(summary.slow_requests), detail: `${formatNumber(summary.slow_database_requests)} with slow database time`, icon: 'bi-hourglass-split', tone: summary.slow_requests || summary.slow_database_requests ? 'warning' : 'success' },
        { key: 'database', label: 'Average database time', value: formatMs(summary.average_db_duration_ms), detail: thresholds.slow_database_ms ? `Slow above ${formatMs(thresholds.slow_database_ms)}` : '', icon: 'bi-database', tone: 'info' },
        { key: 'logins', label: 'Failed sign-ins', value: formatNumber(summary.failed_logins), detail: 'In this window', icon: 'bi-shield-exclamation', tone: summary.failed_logins > 0 ? 'warning' : 'success' },
        { key: 'backups', label: 'Failed backups', value: formatNumber(summary.failed_backups), detail: 'In this window', icon: 'bi-hdd-stack', tone: summary.failed_backups > 0 ? 'danger' : 'success' },
    ];
}

/**
 * Hourly buckets, oldest first. The API stores duration sums, so the average
 * is computed per bucket as sum / requests rather than averaging averages.
 */
export function trendSeries(buckets = []) {
    return [...buckets]
        .filter((bucket) => bucket && bucket.bucket_at)
        .sort((a, b) => new Date(a.bucket_at) - new Date(b.bucket_at))
        .map((bucket) => {
            const requests = Number(bucket.requests) || 0;
            const serverErrors = Number(bucket.server_errors) || 0;
            return {
                bucketAt: bucket.bucket_at,
                requests,
                serverErrors,
                clientErrors: Number(bucket.client_errors) || 0,
                successful: Math.max(0, requests - serverErrors),
                averageMs: requests ? Number(bucket.duration_ms) / requests : 0,
                maxMs: Number(bucket.max_duration_ms) || 0,
                errorRate: requests ? Math.round((10000 * serverErrors) / requests) / 100 : 0,
            };
        });
}

export function trendTotals(series = []) {
    const requests = series.reduce((sum, point) => sum + point.requests, 0);
    const serverErrors = series.reduce((sum, point) => sum + point.serverErrors, 0);
    const durationSum = series.reduce((sum, point) => sum + point.averageMs * point.requests, 0);

    return {
        requests,
        serverErrors,
        errorRate: requests ? Math.round((10000 * serverErrors) / requests) / 100 : 0,
        averageMs: requests ? durationSum / requests : 0,
        peak: series.reduce((best, point) => (point.requests > (best?.requests ?? -1) ? point : best), null),
    };
}

/** Paging fields from a Laravel paginator response. */
export function pageMeta(payload = {}) {
    return {
        page: Number(payload.current_page) || 1,
        lastPage: Number(payload.last_page) || 1,
        total: Number(payload.total) || 0,
        from: payload.from ?? null,
        to: payload.to ?? null,
    };
}

export function componentRows(health) {
    const checks = health?.checks || {};
    return Object.keys(COMPONENT_LABELS)
        .filter((key) => checks[key])
        .concat(Object.keys(checks).filter((key) => !COMPONENT_LABELS[key]))
        .map((key) => {
            const check = checks[key];
            const facts = [];
            if (check.driver) facts.push(['Driver', check.driver]);
            if (check.disk) facts.push(['Disk', check.disk]);
            if (check.queue) facts.push(['Queue', check.queue]);
            if (check.ready_jobs !== undefined) facts.push(['Ready jobs', formatNumber(check.ready_jobs)]);
            if (check.total_jobs !== undefined) facts.push(['Total jobs', formatNumber(check.total_jobs)]);
            if (check.oldest_ready_seconds !== undefined) facts.push(['Oldest waiting', formatSeconds(check.oldest_ready_seconds)]);
            if (check.failed_jobs_in_window !== undefined && check.failed_jobs_in_window !== null) facts.push(['Failed jobs', formatNumber(check.failed_jobs_in_window)]);
            return { key, label: COMPONENT_LABELS[key] || humanise(key), status: check.status || 'unknown', durationMs: check.duration_ms, facts };
        });
}

export function alertLabel(alert) {
    return issueLabel(alert?.condition);
}
