import { createPageRoot } from '../../navigation/page-root.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { PageHeader } from '../../components/PageHeader.js';
import { TechnicalAdminSidebar } from '../../components/TechnicalAdminSidebar.js';
import { useDialogBehaviour } from '../../components/use-dialog-behaviour.js';
import {
    getMonitoringEvent,
    getMonitoringHealth,
    getMonitoringSummary,
    listMonitoringAlerts,
    listMonitoringEvents,
    listMonitoringRequests,
    listMonitoringTrends,
} from '../../api/system-monitoring-api.js';
import {
    AUTO_REFRESH_SECONDS,
    OUTCOME_LABELS,
    OUTCOME_TONES,
    SEVERITY_LABELS,
    SEVERITY_TONES,
    STATUS_ICONS,
    WINDOW_OPTIONS,
    alertLabel,
    componentRows,
    formatDateTime,
    formatMs,
    formatNumber,
    formatPercent,
    formatRelative,
    humanise,
    issueLabel,
    overallStatus,
    pageMeta,
    statusLabel,
    statusTone,
    summaryTiles,
    trendSeries,
    trendTotals,
} from '../../data/system-monitoring-data.js';

enforcePageAccess();

const h = React.createElement;
const { useCallback, useEffect, useMemo, useRef, useState } = React;

const EVENT_SOURCES = ['http', 'auth', 'backup', 'queue', 'monitoring', 'application'];
const STATUS_CODES = [500, 502, 503, 404, 403, 401, 422, 429];
const PER_PAGE = 15;
const emptyEventFilters = { severity: '', source: '', outcome: '', event: '' };

function settledError(result) {
    return result.status === 'rejected' ? (result.reason?.message || 'Could not be loaded.') : '';
}

/* ---------- small pieces ---------- */

function Badge({ tone = 'neutral', icon, children }) {
    return h('span', { className: `ui-badge ui-badge--${tone} sysmon-badge` },
        icon ? h('i', { className: `bi ${icon}`, 'aria-hidden': 'true' }) : null, children);
}

function StatusBadge({ status }) {
    return h(Badge, { tone: statusTone(status), icon: STATUS_ICONS[status] || STATUS_ICONS.unknown }, statusLabel(status));
}

function Section({ id, title, subtitle, icon, actions = null, className = '', children }) {
    return h('section', { className: `ui-card sysmon-section ${className}`.trim(), 'aria-labelledby': `${id}-title` },
        h('div', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' },
                h('h2', { id: `${id}-title` }, title),
                subtitle ? h('p', null, subtitle) : null),
            actions || (icon ? h('i', { className: `bi ${icon}`, 'aria-hidden': 'true' }) : null)),
        h('div', { className: 'ui-card__body' }, children));
}

function SectionError({ message, onRetry }) {
    return h('div', { className: 'sysmon-error', role: 'alert' },
        h('i', { className: 'bi bi-exclamation-circle', 'aria-hidden': 'true' }),
        h('span', null, message),
        onRetry ? h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', onClick: onRetry }, 'Try again') : null);
}

function Empty({ children }) {
    return h('p', { className: 'sysmon-empty' }, children);
}

function Pager({ meta, onPage, disabled, label }) {
    if (!meta || meta.lastPage <= 1) return meta?.total ? h('p', { className: 'sysmon-pager__count' }, `${formatNumber(meta.total)} ${label}`) : null;
    return h('div', { className: 'ui-pagination sysmon-pager' },
        h('span', { className: 'sysmon-pager__count' }, `${formatNumber(meta.total)} ${label} · page ${meta.page} of ${meta.lastPage}`),
        h('div', { className: 'ui-pagination__actions' },
            h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', disabled: disabled || meta.page <= 1, onClick: () => onPage(meta.page - 1) },
                h('i', { className: 'bi bi-chevron-left', 'aria-hidden': 'true' }), 'Previous'),
            h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', disabled: disabled || meta.page >= meta.lastPage, onClick: () => onPage(meta.page + 1) },
                'Next', h('i', { className: 'bi bi-chevron-right', 'aria-hidden': 'true' }))));
}

/* ---------- overview ---------- */

function StatusBanner({ overview }) {
    const { status, reasons } = overall(overview);
    const checkedAt = overview.health?.checked_at || overview.latestCheck?.checked_at;
    return h('div', { className: `sysmon-banner is-${statusTone(status)}`, role: 'status', 'aria-live': 'polite' },
        h('i', { className: `bi ${STATUS_ICONS[status] || STATUS_ICONS.unknown}`, 'aria-hidden': 'true' }),
        h('div', null,
            h('strong', null, status === 'healthy' ? 'All systems are operating normally' : status === 'unknown' ? 'System status is unknown' : `System status: ${statusLabel(status)}`),
            reasons.length
                ? h('ul', null, reasons.slice(0, 5).map((reason) => h('li', { key: reason }, reason)))
                : h('p', null, 'No issues were detected by the latest checks.'),
            checkedAt ? h('small', null, `Last checked ${formatRelative(checkedAt)} (${formatDateTime(checkedAt)})`) : null));
}

function overall(overview) {
    return overallStatus({
        health: overview.health,
        latestCheck: overview.latestCheck,
        schedulerStale: overview.schedulerStale,
        collectionEnabled: overview.collectionEnabled,
    });
}

function Tiles({ summary }) {
    return h('div', { className: 'sysmon-tiles', 'aria-label': 'Key figures for the selected period' },
        summaryTiles(summary).map((tile) => h('article', { key: tile.key, className: `sysmon-tile sysmon-tile--${tile.tone}` },
            h('i', { className: `bi ${tile.icon}`, 'aria-hidden': 'true' }),
            h('div', null,
                h('span', { className: 'sysmon-tile__label' }, tile.label),
                h('strong', { className: 'sysmon-tile__value' }, tile.value),
                tile.detail ? h('small', null, tile.detail) : null))));
}

function HealthPanel({ health, error, onRetry }) {
    const rows = componentRows(health);
    return h(Section, { id: 'sysmon-health', title: 'Service health', subtitle: 'Live checks of the services the system depends on', icon: 'bi-heart-pulse' },
        error ? h(SectionError, { message: error, onRetry })
            : !rows.length ? h(Empty, null, 'No health checks were reported.')
            : h('ul', { className: 'sysmon-health' }, rows.map((row) => h('li', { key: row.key, className: `sysmon-health__item is-${statusTone(row.status)}` },
                h('div', { className: 'sysmon-health__head' },
                    h('strong', null, row.label),
                    h(StatusBadge, { status: row.status })),
                h('dl', { className: 'sysmon-health__facts' },
                    h('div', null, h('dt', null, 'Response'), h('dd', null, formatMs(row.durationMs))),
                    row.facts.map(([label, value]) => h('div', { key: label }, h('dt', null, label), h('dd', null, value))))))));
}

function AlertsPanel({ alerts, error, onRetry, showResolved, onToggleResolved }) {
    const toggle = h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', onClick: onToggleResolved, 'aria-pressed': showResolved },
        showResolved ? 'Show open only' : 'Include resolved');
    return h(Section, { id: 'sysmon-alerts', title: showResolved ? 'Alerts' : 'Open alerts', subtitle: 'Problems detected by scheduled checks', actions: toggle },
        error ? h(SectionError, { message: error, onRetry })
            : !alerts.length ? h(Empty, null, showResolved ? 'No alerts have been recorded.' : 'There are no open alerts.')
            : h('ul', { className: 'sysmon-alerts' }, alerts.map((alert) => h('li', { key: alert.id },
                h('div', null,
                    h('strong', null, alertLabel(alert)),
                    h('small', null, alert.status === 'resolved'
                        ? `Opened ${formatDateTime(alert.opened_at)} · resolved ${formatDateTime(alert.resolved_at)}`
                        : `Open since ${formatDateTime(alert.opened_at)} · last seen ${formatRelative(alert.last_seen_at)}`),
                    h('small', { className: 'sysmon-code' }, `${alert.condition} · seen ${formatNumber(alert.occurrences)} time${Number(alert.occurrences) === 1 ? '' : 's'}`)),
                h('div', { className: 'sysmon-alerts__badges' },
                    h(Badge, { tone: SEVERITY_TONES[alert.severity] || 'neutral' }, SEVERITY_LABELS[alert.severity] || humanise(alert.severity)),
                    h(Badge, { tone: alert.status === 'resolved' ? 'success' : 'warning' }, alert.status === 'resolved' ? 'Resolved' : 'Open'))))));
}

/* ---------- trend chart ---------- */

function TrendChart({ buckets, error, onRetry }) {
    const series = useMemo(() => trendSeries(buckets), [buckets]);
    const totals = useMemo(() => trendTotals(series), [series]);
    const [hover, setHover] = useState(null);
    const [showTable, setShowTable] = useState(false);

    const width = 1000;
    const height = 200;
    const pad = { top: 12, right: 8, bottom: 26, left: 40 };
    const max = Math.max(1, ...series.map((point) => point.requests));
    const niceMax = niceCeiling(max);
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const slot = series.length ? plotW / series.length : plotW;
    const barW = Math.max(2, Math.min(28, slot - 4));
    const y = (value) => pad.top + plotH - (value / niceMax) * plotH;
    const ticks = [0, niceMax / 2, niceMax];
    const hourLabel = (value) => new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    const toggle = h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', onClick: () => setShowTable((value) => !value), 'aria-pressed': showTable },
        h('i', { className: `bi ${showTable ? 'bi-bar-chart' : 'bi-table'}`, 'aria-hidden': 'true' }), showTable ? 'Show chart' : 'Show table');

    let content;
    if (error) content = h(SectionError, { message: error, onRetry });
    else if (!series.length) content = h(Empty, null, 'No hourly activity has been recorded in the last 24 hours.');
    else if (showTable) {
        content = h('div', { className: 'ui-table-wrap' }, h('table', { className: 'ui-table sysmon-table' },
            h('thead', null, h('tr', null, ['Hour', 'Requests', 'Server errors', 'Client errors', 'Error rate', 'Average', 'Slowest'].map((label) => h('th', { key: label, scope: 'col' }, label)))),
            h('tbody', null, [...series].reverse().map((point) => h('tr', { key: point.bucketAt },
                h('td', null, formatDateTime(point.bucketAt)),
                h('td', null, formatNumber(point.requests)),
                h('td', null, formatNumber(point.serverErrors)),
                h('td', null, formatNumber(point.clientErrors)),
                h('td', null, formatPercent(point.errorRate)),
                h('td', null, formatMs(point.averageMs)),
                h('td', null, formatMs(point.maxMs)))))));
    } else {
        const labelEvery = Math.max(1, Math.ceil(series.length / 8));
        const active = hover !== null ? series[hover] : null;
        content = h('div', { className: 'sysmon-chart' },
            h('div', { className: 'sysmon-chart__legend', 'aria-hidden': 'true' },
                h('span', null, h('i', { className: 'sysmon-swatch sysmon-swatch--ok' }), 'Completed requests'),
                h('span', null, h('i', { className: 'sysmon-swatch sysmon-swatch--error' }), 'Server errors (5xx)')),
            h('div', { className: 'sysmon-chart__frame', onMouseLeave: () => setHover(null) },
                h('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `Hourly API requests for the last 24 hours: ${formatNumber(totals.requests)} requests, ${formatNumber(totals.serverErrors)} server errors.` },
                    ticks.map((tick) => h('g', { key: tick },
                        h('line', { x1: pad.left, x2: width - pad.right, y1: y(tick), y2: y(tick), className: 'sysmon-chart__grid' }),
                        h('text', { x: pad.left - 6, y: y(tick) + 4, className: 'sysmon-chart__axis', textAnchor: 'end' }, formatNumber(Math.round(tick))))),
                    series.map((point, index) => {
                        const x = pad.left + index * slot + (slot - barW) / 2;
                        const okTop = y(point.requests);
                        const errorHeight = (point.serverErrors / niceMax) * plotH;
                        const okHeight = Math.max(0, y(point.serverErrors) - okTop - (point.serverErrors ? 2 : 0));
                        return h('g', { key: point.bucketAt, className: hover === index ? 'is-active' : '' },
                            point.successful > 0 ? h('rect', { x, y: okTop, width: barW, height: okHeight, rx: 3, className: 'sysmon-chart__bar' }) : null,
                            point.serverErrors > 0 ? h('rect', { x, y: pad.top + plotH - errorHeight, width: barW, height: Math.max(2, errorHeight), rx: 3, className: 'sysmon-chart__bar sysmon-chart__bar--error' }) : null,
                            index % labelEvery === 0 ? h('text', { x: x + barW / 2, y: height - 8, className: 'sysmon-chart__axis', textAnchor: 'middle' }, hourLabel(point.bucketAt)) : null,
                            h('rect', { x: pad.left + index * slot, y: pad.top, width: slot, height: plotH, className: 'sysmon-chart__hit', onMouseEnter: () => setHover(index), onFocus: () => setHover(index), onBlur: () => setHover(null), tabIndex: 0, 'aria-label': `${formatDateTime(point.bucketAt)}: ${formatNumber(point.requests)} requests, ${formatNumber(point.serverErrors)} server errors` }));
                    })),
                active ? h('div', { className: 'sysmon-chart__tooltip', style: { left: `${((pad.left + hover * slot + slot / 2) / width) * 100}%` }, role: 'tooltip' },
                    h('strong', null, formatDateTime(active.bucketAt)),
                    h('span', null, `${formatNumber(active.requests)} requests`),
                    h('span', null, `${formatNumber(active.serverErrors)} server errors (${formatPercent(active.errorRate)})`),
                    h('span', null, `Average ${formatMs(active.averageMs)} · slowest ${formatMs(active.maxMs)}`)) : null),
            h('p', { className: 'sysmon-chart__summary' },
                `${formatNumber(totals.requests)} requests · ${formatPercent(totals.errorRate)} server error rate · average ${formatMs(totals.averageMs)}`,
                totals.peak ? ` · busiest hour ${hourLabel(totals.peak.bucketAt)} (${formatNumber(totals.peak.requests)})` : ''));
    }

    return h(Section, { id: 'sysmon-trends', title: 'Activity over the last 24 hours', subtitle: 'Hourly API requests and server errors', actions: toggle, className: 'sysmon-section--wide' }, content);
}

function niceCeiling(value) {
    const power = 10 ** Math.floor(Math.log10(value));
    const step = [1, 2, 5, 10].find((candidate) => candidate * power >= value) || 10;
    return step * power;
}

/* ---------- events ---------- */

function EventDialog({ eventId, onClose }) {
    const [state, setState] = useState({ loading: true, error: '', event: null });
    const ref = useDialogBehaviour(true, onClose);

    useEffect(() => {
        let active = true;
        getMonitoringEvent(eventId)
            .then((payload) => { if (active) setState({ loading: false, error: '', event: payload.data }); })
            .catch((error) => { if (active) setState({ loading: false, error: error.status === 404 ? 'This event is no longer available.' : error.message, event: null }); });
        return () => { active = false; };
    }, [eventId]);

    const event = state.event;
    return h('div', { className: 'sysmon-dialog-backdrop', role: 'presentation', onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
        h('section', { ref, className: 'ui-card sysmon-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sysmon-event-title' },
            h('header', { className: 'sysmon-dialog__header' },
                h('div', null,
                    h('h2', { id: 'sysmon-event-title' }, event ? humanise(event.event) : 'Event details'),
                    h('p', null, event ? h('code', null, event.event) : `Event #${eventId}`)),
                h('button', { type: 'button', className: 'sysmon-dialog__close', onClick: onClose, 'aria-label': 'Close event details' },
                    h('i', { className: 'bi bi-x-lg', 'aria-hidden': 'true' }))),
            h('div', { className: 'sysmon-dialog__body' },
                state.loading ? h('p', { role: 'status' }, 'Loading event…')
                    : state.error ? h(SectionError, { message: state.error })
                    : h(React.Fragment, null,
                        h('dl', { className: 'sysmon-facts' },
                            h('div', null, h('dt', null, 'When'), h('dd', null, formatDateTime(event.occurred_at))),
                            h('div', null, h('dt', null, 'Source'), h('dd', null, humanise(event.source))),
                            h('div', null, h('dt', null, 'Severity'), h('dd', null, h(Badge, { tone: SEVERITY_TONES[event.severity] }, SEVERITY_LABELS[event.severity] || event.severity))),
                            h('div', null, h('dt', null, 'Outcome'), h('dd', null, h(Badge, { tone: OUTCOME_TONES[event.outcome] }, OUTCOME_LABELS[event.outcome] || event.outcome))),
                            h('div', { className: 'sysmon-facts__wide' }, h('dt', null, 'Request ID'), h('dd', null, event.request_id ? h('code', null, event.request_id) : '—')),
                            h('div', null, h('dt', null, 'Event ID'), h('dd', null, `#${event.id}`))),
                        h('div', { className: 'sysmon-context' },
                            h('h3', null, 'Recorded details'),
                            event.context && Object.keys(event.context).length
                                ? h('pre', null, JSON.stringify(event.context, null, 2))
                                : h('p', null, 'No additional details were recorded.'))))));
}

function EventsPanel({ windowMinutes, refreshKey }) {
    const [filters, setFilters] = useState(emptyEventFilters);
    const [page, setPage] = useState(1);
    const [state, setState] = useState({ loading: true, error: '', rows: [], meta: null, fieldErrors: {} });
    const [selected, setSelected] = useState(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => { setPage(1); }, [windowMinutes, filters]);

    useEffect(() => {
        let active = true;
        setState((current) => ({ ...current, loading: true, error: '' }));
        listMonitoringEvents({ minutes: windowMinutes, per_page: PER_PAGE, page, ...filters })
            .then((payload) => { if (active) setState({ loading: false, error: '', rows: payload.data || [], meta: pageMeta(payload), fieldErrors: {} }); })
            .catch((error) => { if (active) setState({ loading: false, error: error.message, rows: [], meta: null, fieldErrors: error.errors || {} }); });
        return () => { active = false; };
    }, [windowMinutes, filters, page, refreshKey, attempt]);

    function select(key, label, options) {
        const id = `sysmon-event-${key}`;
        return h('div', { className: 'ui-field', key },
            h('label', { className: 'ui-label', htmlFor: id }, label),
            h('select', { id, className: 'ui-select', value: filters[key], onChange: (e) => setFilters({ ...filters, [key]: e.target.value }) },
                h('option', { value: '' }, 'All'),
                options.map(([value, text]) => h('option', { key: value, value }, text))));
    }

    const [eventDraft, setEventDraft] = useState('');
    const eventError = state.fieldErrors?.event?.[0];
    const hasFilters = Object.values(filters).some(Boolean);

    return h(Section, { id: 'sysmon-events', title: 'Activity events', subtitle: 'Errors, slow requests, sign-in problems, backups and alert changes in the selected period', icon: 'bi-list-ul', className: 'sysmon-section--wide' },
        h('form', { className: 'sysmon-filters', onSubmit: (e) => { e.preventDefault(); setFilters({ ...filters, event: eventDraft.trim().toLowerCase() }); } },
            select('severity', 'Severity', Object.entries(SEVERITY_LABELS)),
            select('source', 'Source', EVENT_SOURCES.map((source) => [source, humanise(source)])),
            select('outcome', 'Outcome', Object.entries(OUTCOME_LABELS)),
            h('div', { className: `ui-field${eventError ? ' is-invalid' : ''}` },
                h('label', { className: 'ui-label', htmlFor: 'sysmon-event-code' }, 'Event code'),
                h('input', { id: 'sysmon-event-code', className: 'ui-input', placeholder: 'e.g. http.error', value: eventDraft, maxLength: 100, onChange: (e) => setEventDraft(e.target.value) }),
                eventError ? h('p', { className: 'ui-error' }, 'Use lowercase letters, dots and underscores only.') : null),
            h('div', { className: 'sysmon-filters__actions' },
                h('button', { type: 'submit', className: 'ui-button ui-button--primary ui-button--sm' }, 'Apply'),
                h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', disabled: !hasFilters && !eventDraft, onClick: () => { setEventDraft(''); setFilters(emptyEventFilters); } }, 'Clear'))),
        state.error && !eventError ? h(SectionError, { message: state.error, onRetry: () => setAttempt((value) => value + 1) }) : null,
        state.loading && !state.rows.length ? h('p', { className: 'sysmon-empty', role: 'status' }, 'Loading activity events…')
            : !state.error && !state.rows.length ? h(Empty, null, hasFilters ? 'No events match these filters in the selected period.' : 'No activity events were recorded in the selected period.')
            : state.rows.length ? h('div', { className: 'ui-table-wrap', 'aria-busy': state.loading }, h('table', { className: 'ui-table sysmon-table' },
                h('thead', null, h('tr', null, ['When', 'Event', 'Source', 'Severity', 'Outcome', 'Details', ''].map((label, index) => h('th', { key: index, scope: 'col' }, label)))),
                h('tbody', null, state.rows.map((event) => h('tr', { key: event.id },
                    h('td', { className: 'sysmon-when' }, formatDateTime(event.occurred_at)),
                    h('td', null, h('strong', null, humanise(event.event)), h('code', { className: 'sysmon-code' }, event.event)),
                    h('td', null, humanise(event.source)),
                    h('td', null, h(Badge, { tone: SEVERITY_TONES[event.severity] || 'neutral' }, SEVERITY_LABELS[event.severity] || event.severity)),
                    h('td', null, h(Badge, { tone: OUTCOME_TONES[event.outcome] || 'neutral' }, OUTCOME_LABELS[event.outcome] || event.outcome)),
                    h('td', { className: 'sysmon-muted' }, eventSummary(event)),
                    h('td', null, h('button', { type: 'button', className: 'ui-button ui-button--secondary ui-button--sm', onClick: () => setSelected(event.id), 'aria-label': `View details for ${event.event} at ${formatDateTime(event.occurred_at)}` }, 'View'))))))) : null,
        h(Pager, { meta: state.meta, onPage: setPage, disabled: state.loading, label: 'events' }),
        selected !== null ? h(EventDialog, { eventId: selected, onClose: () => setSelected(null) }) : null);
}

function eventSummary(event) {
    const context = event.context || {};
    const parts = [];
    if (context.method || context.route) parts.push([context.method, context.route].filter(Boolean).join(' '));
    if (context.status_code) parts.push(`HTTP ${context.status_code}`);
    if (context.duration_ms !== undefined) parts.push(formatMs(context.duration_ms));
    if (context.reason) parts.push(humanise(context.reason));
    if (context.condition) parts.push(issueLabel(context.condition));
    return parts.join(' · ') || '—';
}

/* ---------- requests ---------- */

function RequestsPanel({ windowMinutes, refreshKey, thresholds }) {
    const [filters, setFilters] = useState({ slow: false, status_code: '' });
    const [page, setPage] = useState(1);
    const [state, setState] = useState({ loading: true, error: '', rows: [], meta: null });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => { setPage(1); }, [windowMinutes, filters]);

    useEffect(() => {
        let active = true;
        setState((current) => ({ ...current, loading: true, error: '' }));
        listMonitoringRequests({ minutes: windowMinutes, per_page: PER_PAGE, page, slow: filters.slow ? 1 : '', status_code: filters.status_code })
            .then((payload) => { if (active) setState({ loading: false, error: '', rows: payload.data || [], meta: pageMeta(payload) }); })
            .catch((error) => { if (active) setState({ loading: false, error: error.message, rows: [], meta: null }); });
        return () => { active = false; };
    }, [windowMinutes, filters, page, refreshKey, attempt]);

    const slowMs = thresholds?.slow_request_ms;
    const slowDbMs = thresholds?.slow_database_ms;
    const hasFilters = filters.slow || filters.status_code;

    return h(Section, { id: 'sysmon-requests', title: 'Recent API requests', subtitle: 'Route, response code and timing for each measured request', icon: 'bi-arrow-left-right', className: 'sysmon-section--wide' },
        h('div', { className: 'sysmon-filters sysmon-filters--compact' },
            h('div', { className: 'ui-field' },
                h('label', { className: 'ui-label', htmlFor: 'sysmon-request-status' }, 'Response code'),
                h('select', { id: 'sysmon-request-status', className: 'ui-select', value: filters.status_code, onChange: (e) => setFilters({ ...filters, status_code: e.target.value }) },
                    h('option', { value: '' }, 'All codes'),
                    STATUS_CODES.map((code) => h('option', { key: code, value: code }, code)))),
            h('label', { className: 'sysmon-check' },
                h('input', { type: 'checkbox', checked: filters.slow, onChange: (e) => setFilters({ ...filters, slow: e.target.checked }) }),
                h('span', null, slowMs ? `Slow only (${formatMs(slowMs)} or more)` : 'Slow only'))),
        state.error ? h(SectionError, { message: state.error, onRetry: () => setAttempt((value) => value + 1) }) : null,
        state.loading && !state.rows.length ? h('p', { className: 'sysmon-empty', role: 'status' }, 'Loading requests…')
            : !state.error && !state.rows.length ? h(Empty, null, hasFilters ? 'No requests match these filters in the selected period.' : 'No API requests were measured in the selected period.')
            : state.rows.length ? h('div', { className: 'ui-table-wrap', 'aria-busy': state.loading }, h('table', { className: 'ui-table sysmon-table' },
                h('thead', null, h('tr', null, ['When', 'Request', 'Status', 'Duration', 'Database', 'Queries', 'Exception'].map((label) => h('th', { key: label, scope: 'col' }, label)))),
                h('tbody', null, state.rows.map((row) => h('tr', { key: row.id },
                    h('td', { className: 'sysmon-when' }, formatDateTime(row.occurred_at)),
                    h('td', null, h('code', { className: 'sysmon-route' }, `${row.method} ${row.route}`)),
                    h('td', null, h(Badge, { tone: row.status_code >= 500 ? 'danger' : row.status_code >= 400 ? 'warning' : 'success' }, row.status_code)),
                    h('td', { className: slowMs && row.duration_ms >= slowMs ? 'sysmon-slow' : '' }, formatMs(row.duration_ms)),
                    h('td', { className: slowDbMs && row.db_duration_ms >= slowDbMs ? 'sysmon-slow' : '' }, formatMs(row.db_duration_ms)),
                    h('td', null, formatNumber(row.db_query_count)),
                    h('td', { className: 'sysmon-muted' }, row.exception_type ? h('code', null, row.exception_type.split('\\').pop()) : '—')))))) : null,
        h(Pager, { meta: state.meta, onPage: setPage, disabled: state.loading, label: 'requests' }));
}

/* ---------- page ---------- */

function SystemMonitoringApp() {
    const [windowMinutes, setWindowMinutes] = useState(15);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [showResolved, setShowResolved] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [notice, setNotice] = useState('');
    const [overview, setOverview] = useState({ loading: true, loadedAt: null, summary: null, latestCheck: null, schedulerStale: false, collectionEnabled: true, health: null, alerts: [], buckets: [], errors: {} });
    const inFlight = useRef(false);

    const loadOverview = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        setOverview((current) => ({ ...current, loading: true }));
        const [summary, health, alerts, trends] = await Promise.allSettled([
            getMonitoringSummary({ minutes: windowMinutes }),
            getMonitoringHealth(),
            listMonitoringAlerts({ per_page: 20, status: showResolved ? '' : 'open' }),
            listMonitoringTrends({ minutes: 1440, per_page: 24 }),
        ]);
        inFlight.current = false;
        setOverview((current) => ({
            loading: false,
            loadedAt: new Date(),
            summary: summary.status === 'fulfilled' ? summary.value.data : current.summary,
            latestCheck: summary.status === 'fulfilled' ? summary.value.latest_check : current.latestCheck,
            schedulerStale: summary.status === 'fulfilled' ? Boolean(summary.value.scheduler_stale) : current.schedulerStale,
            collectionEnabled: summary.status === 'fulfilled' ? summary.value.collection_enabled !== false : current.collectionEnabled,
            health: health.status === 'fulfilled' ? health.value.data : current.health,
            alerts: alerts.status === 'fulfilled' ? alerts.value.data || [] : current.alerts,
            buckets: trends.status === 'fulfilled' ? trends.value.data || [] : current.buckets,
            errors: { summary: settledError(summary), health: settledError(health), alerts: settledError(alerts), trends: settledError(trends) },
        }));
    }, [windowMinutes, showResolved]);

    useEffect(() => { loadOverview(); }, [loadOverview, refreshKey]);

    useEffect(() => {
        if (!autoRefresh) return undefined;
        const timer = window.setInterval(() => {
            if (document.visibilityState === 'visible') setRefreshKey((value) => value + 1);
        }, AUTO_REFRESH_SECONDS * 1000);
        return () => window.clearInterval(timer);
    }, [autoRefresh]);

    const allFailed = ['summary', 'health', 'alerts', 'trends'].every((key) => overview.errors[key]);
    const firstLoad = overview.loading && !overview.loadedAt;
    const refresh = () => setRefreshKey((value) => value + 1);

    const controls = h('div', { className: 'sysmon-controls' },
        h('label', { className: 'ui-visually-hidden', htmlFor: 'sysmon-window' }, 'Time period'),
        h('select', { id: 'sysmon-window', className: 'ui-select', value: windowMinutes, onChange: (e) => setWindowMinutes(Number(e.target.value)) },
            WINDOW_OPTIONS.map((option) => h('option', { key: option.minutes, value: option.minutes }, option.label))),
        h('label', { className: 'sysmon-check' },
            h('input', { type: 'checkbox', checked: autoRefresh, onChange: (e) => setAutoRefresh(e.target.checked) }),
            h('span', null, `Auto-refresh (${AUTO_REFRESH_SECONDS}s)`)),
        h('button', { type: 'button', className: 'ui-button ui-button--secondary', onClick: refresh, disabled: overview.loading },
            h('i', { className: `bi bi-arrow-clockwise${overview.loading ? ' sysmon-spin' : ''}`, 'aria-hidden': 'true' }), overview.loading ? 'Refreshing…' : 'Refresh'));

    let body;
    if (firstLoad) {
        body = h('div', { role: 'status' },
            h('span', { className: 'ui-visually-hidden' }, 'Loading system activity…'),
            h('div', { className: 'sysmon-skeleton', 'aria-hidden': 'true' },
                h('div', { className: 'sysmon-skeleton__banner' }),
                h('div', { className: 'sysmon-tiles' }, [1, 2, 3, 4].map((key) => h('div', { key, className: 'sysmon-skeleton__tile' })))));
    } else if (allFailed) {
        body = h('div', { className: 'ui-card' }, h('div', { className: 'ui-card__body' },
            h(SectionError, { message: overview.errors.summary, onRetry: refresh })));
    } else {
        body = h(React.Fragment, null,
            h(StatusBanner, { overview }),
            overview.errors.summary ? h(SectionError, { message: `Key figures: ${overview.errors.summary}`, onRetry: refresh }) : h(Tiles, { summary: overview.summary }),
            h('div', { className: 'sysmon-grid' },
                h(HealthPanel, { health: overview.health, error: overview.errors.health, onRetry: refresh }),
                h(AlertsPanel, { alerts: overview.alerts, error: overview.errors.alerts, onRetry: refresh, showResolved, onToggleResolved: () => setShowResolved((value) => !value) })),
            h(TrendChart, { buckets: overview.buckets, error: overview.errors.trends, onRetry: refresh }),
            h(EventsPanel, { windowMinutes, refreshKey }),
            h(RequestsPanel, { windowMinutes, refreshKey, thresholds: overview.summary?.thresholds }));
    }

    return h('div', { className: 'sysmon-shell' },
        h(TechnicalAdminSidebar, { onNotice: setNotice }),
        h('main', { className: 'app-shell-main sysmon-page', 'aria-busy': overview.loading },
            h('div', { className: 'app-shell-container' },
                h(PageHeader, {
                    section: 'Security Management',
                    title: 'System Activity',
                    subtitle: 'Monitor service health, request performance, errors, sign-in failures and alerts across the system.',
                    actions: controls,
                }),
                overview.loadedAt ? h('p', { className: 'sysmon-updated' }, `Updated ${overview.loadedAt.toLocaleTimeString()}${autoRefresh ? ' · refreshing automatically' : ''}`) : null,
                notice ? h('div', { className: 'ui-status ui-status--info', role: 'status' }, notice) : null,
                body)));
}

createPageRoot(document.getElementById('root')).render(h(SystemMonitoringApp));
