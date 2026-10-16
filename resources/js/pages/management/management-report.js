import { apiRequest } from '../../api/api-client.js';
import { sectionGate, useManagementSource, EmptyState } from './management-sections.js';

// Report master preview: the backend decides sections and rows; this module only renders and exports.
const h = (...args) => React.createElement(...args);

export function reportQueryString(filters) {
    const params = new URLSearchParams();
    [['plan_id', filters.planId], ['period', filters.period], ['office', filters.office], ['status', filters.status], ['approval_status', filters.approvalStatus]]
        .forEach(([key, value]) => { if (value) params.set(key, value); });
    return params.toString();
}

const MANAGEMENT_ENDPOINT = '/api/management/reports/master';

export function exportUrl(filters, section, table, endpoint = MANAGEMENT_ENDPOINT, toQuery = reportQueryString) {
    const params = new URLSearchParams(toQuery(filters));
    params.set('format', 'csv');
    params.set('section', section);
    if (table) params.set('table', table);
    return `${endpoint}/export?${params}`;
}

// Rows grouped by a column keep their order; a heading row starts each group.
export function groupRows(rows, key) {
    if (!key) return [{ group: null, rows }];
    return rows.reduce((groups, row) => {
        const last = groups[groups.length - 1];
        if (last && last.group === row[key]) last.rows.push(row);
        else groups.push({ group: row[key], rows: [row] });
        return groups;
    }, []);
}

function filenameFrom(response, fallback) {
    const match = /filename="?([^";]+)"?/i.exec(response.headers.get('Content-Disposition') || '');
    return match ? match[1] : fallback;
}

async function downloadExport(url, fallback) {
    const response = await fetch(url, { credentials: 'include', headers: { Accept: 'text/csv, application/json' } });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || `Export failed (${response.status}).`);
    }
    const blobUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filenameFrom(response, fallback);
    link.click();
    URL.revokeObjectURL(blobUrl);
}

function ExportButton({ filters, section, table, disabled, source }) {
    const [state, setState] = React.useState({ busy: false, error: '' });
    async function run() {
        setState({ busy: true, error: '' });
        try {
            await downloadExport(exportUrl(filters, section, table.id, source.endpoint, source.toQuery), `${source.filePrefix}-${section}-${table.id}.csv`);
            setState({ busy: false, error: '' });
        } catch (error) {
            setState({ busy: false, error: error.message });
        }
    }
    return h('span', { className: 'management-report__export no-print' },
        h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: disabled || state.busy || !table.rows.length, onClick: run, 'aria-label': `Export ${table.title} as CSV` },
            h('i', { className: 'bi bi-filetype-csv', 'aria-hidden': true }), state.busy ? ' Exporting…' : ' Export CSV'),
        state.error ? h('span', { className: 'management-report__export-error', role: 'alert' }, state.error) : null);
}

function ReportTable({ table, section, filters, canExport, filtered, onClear, source, emptyMessage }) {
    const columns = table.columns.filter(column => column.key !== table.group_by);
    return h('div', { className: 'management-report__table' },
        h('div', { className: 'management-report__table-heading' },
            h('h3', null, table.title, h('span', null, ` · ${table.rows.length} ${table.rows.length === 1 ? 'row' : 'rows'}`)),
            canExport ? h(ExportButton, { filters, section, table, source }) : null),
        !table.rows.length ? h(EmptyState, { filtered, onClear, message: emptyMessage })
            : h('div', { className: 'management-table-scroll management-report__scroll' }, h('table', null,
                h('thead', null, h('tr', null, columns.map(column => h('th', { key: column.key, scope: 'col' }, column.label)))),
                groupRows(table.rows, table.group_by).map((group, index) => h('tbody', { key: `${group.group}-${index}` },
                    group.group !== null ? h('tr', { className: 'management-report__group' }, h('th', { colSpan: columns.length, scope: 'colgroup' }, group.group || '—')) : null,
                    group.rows.map((row, rowIndex) => h('tr', { key: rowIndex }, columns.map(column => h('td', { key: column.key }, row[column.key] === '' || row[column.key] == null ? '—' : String(row[column.key]))))))))));
}

export function ReportSection({ section, filters, canExport, filtered, onClear, source = MANAGEMENT_SOURCE, emptyMessage = 'No records in your authorised scope.', numbered = true }) {
    return h('section', { className: 'management-card management-report__section', 'aria-labelledby': `report-${section.id}` },
        h('div', { className: 'management-card__heading' }, h('div', null,
            h('h2', { id: `report-${section.id}` }, numbered ? h('span', { className: 'management-report__number' }, section.number) : null, section.title),
            section.description ? h('p', null, section.description) : null)),
        section.kpis ? h('div', { className: 'management-report__kpis' }, section.kpis.map(kpi => h('article', { key: kpi.key, className: `management-report__kpi${kpi.available ? '' : ' is-muted'}` },
            h('small', null, kpi.label), h('strong', null, kpi.available ? kpi.value : 'No access'), h('span', null, kpi.detail)))) : null,
        (section.tables || []).filter(table => !(section.kpis && table.id === 'kpis')).map(table => h(ReportTable, { key: table.id, table, section: section.id, filters, canExport, filtered, onClear, source, emptyMessage })),
        section.kpis && canExport ? h('div', { className: 'management-report__kpi-export' }, h(ExportButton, { filters, section: section.id, table: section.tables[0], source })) : null,
        section.definitions ? h('dl', { className: 'management-report__definitions' }, section.definitions.map(item => h(React.Fragment, { key: item.term }, h('dt', null, item.term), h('dd', null, item.definition)))) : null);
}

const MANAGEMENT_SOURCE = { endpoint: MANAGEMENT_ENDPOINT, toQuery: reportQueryString, filePrefix: 'management-report' };

// `source` names the report endpoint, how filters become its query string and the export file prefix,
// so other report masters (for example the Technical Admin activity report) reuse this preview.
// `data` renders an already loaded report instead of fetching it.
export function ManagementReport({ filters, refresh, canExport, filtered, onClear, source: reportSource = MANAGEMENT_SOURCE, data = null, emptyMessage }) {
    const query = reportSource.toQuery(filters);
    const loaded = useManagementSource(() => apiRequest(`${reportSource.endpoint}${query ? `?${query}` : ''}`).then(response => response.data), { enabled: !data, deps: [query, refresh] });
    const gate = data ? null : sectionGate([{ label: 'The report', source: loaded }], { lines: 8 });
    if (gate) return h('section', { className: 'management-card' }, gate);
    const report = data || loaded.data;
    const [cover, ...sections] = report.sections;
    const generated = new Date(report.meta.generated_at);
    const generatedText = Number.isNaN(generated.getTime()) ? report.meta.generated_at : generated.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
    return h('div', { className: 'management-report' },
        h('div', { className: 'management-report__toolbar no-print' },
            h('p', null, h('i', { className: 'bi bi-info-circle', 'aria-hidden': true }), ' Preview of the formal report for the current filters. Use Print / Save as PDF for the formal copy.'),
            h('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', onClick: () => window.print() }, h('i', { className: 'bi bi-printer', 'aria-hidden': true }), ' Print / Save as PDF')),
        h('div', { className: 'management-report__print-header', 'aria-hidden': true }, `${report.meta.title} · ${report.meta.planning_period}`),
        h('div', { className: 'management-report__print-footer', 'aria-hidden': true }, `Generated ${generatedText} by ${report.meta.generated_by} · ${report.meta.scope}`),
        h('article', { className: 'management-card management-report__cover', 'aria-labelledby': 'report-cover-title' },
            h('div', { className: 'management-report__band', 'aria-hidden': true }),
            h('p', { className: 'management-report__eyebrow' }, report.meta.role || 'Strategic Plan Development Management System'),
            h('h2', { id: 'report-cover-title' }, report.meta.title),
            h('p', { className: 'management-report__period' }, report.meta.planning_period),
            h('dl', null, cover.fields.filter(field => !(field.label === 'Sections omitted' && report.omitted_sections.length)).map(field => h(React.Fragment, { key: field.label }, h('dt', null, field.label), h('dd', null, field.value)))),
            report.omitted_sections.length ? h('div', { className: 'management-report__omitted', role: 'note' },
                h('strong', null, 'Sections not included'),
                h('ul', null, report.omitted_sections.map(item => h('li', { key: item.id }, `${item.number}. ${item.title} — ${item.reason}`))),
                h('p', null, 'These sections are omitted because of access permissions. Do not read them as zero.')) : null,
            h('nav', { className: 'management-report__contents', 'aria-label': 'Report contents' }, h('strong', null, 'Contents'),
                h('ol', null, sections.map(section => h('li', { key: section.id, value: section.number }, h('a', { href: `#report-${section.id}` }, section.title)))))),
        sections.map(section => h(ReportSection, { key: section.id, section, filters, canExport, filtered, onClear, source: reportSource, emptyMessage })));
}
