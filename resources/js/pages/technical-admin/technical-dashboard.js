import { AppSidebar } from '../../components/AppSidebar.js';
import { Breadcrumb } from '../../components/PageHeader.js';
import { apiRequest } from '../../api/api-client.js';
import { navigationFor, flattenNavigation, canOpenPage } from '../../access/navigation.js';
import { useManagementSource, sectionGate, SectionCard } from '../management/management-sections.js';
import { ManagementReport, ReportSection } from '../management/management-report.js';
import '../../../css/office.css';
import '../../../css/management-dashboard.css';
import '../../../css/technical-dashboard.css';

// Technical Administration Dashboard, built on the Management dashboard and report masters:
// header with "Data as of", KPI row, section tabs and a Reports tab. Every figure comes from
// /api/technical/reports/activity, so the dashboard and the printed report always agree.
const h = React.createElement;
const ENDPOINT = '/api/technical/reports/activity';
const PERIODS = [7, 30, 90];
const SOURCE = { endpoint: ENDPOINT, toQuery: filters => new URLSearchParams({ days: String(filters.days) }).toString(), filePrefix: 'technical-report' };
const TABS = [
    { id: 'overview', label: 'Overview', icon: 'bi-grid-1x2', sections: [] },
    { id: 'access', label: 'Accounts & Access', icon: 'bi-person-lock', sections: ['accounts', 'assistance', 'workflow'] },
    { id: 'security', label: 'Security Activity', icon: 'bi-shield-check', sections: ['signins', 'audit'] },
    { id: 'system', label: 'System & Backups', icon: 'bi-hdd-network', sections: ['health', 'backups'] },
    { id: 'reports', label: 'Reports & Summary', icon: 'bi-file-earmark-bar-graph', sections: [] },
];

function readQuery() {
    const params = new URLSearchParams(window.location.search);
    const days = Number(params.get('days'));
    return { tab: params.get('tab') || 'overview', days: PERIODS.includes(days) ? days : 30 };
}

function KpiCard({ kpi, state, retry }) {
    const body = state === 'loading'
        ? h(React.Fragment, null, h('span', { className: 'management-skeleton management-skeleton--value', 'aria-hidden': true }), h('span', { className: 'ui-visually-hidden' }, 'Loading'))
        : state === 'error'
            ? h(React.Fragment, null, h('strong', null, '—'), h('button', { className: 'management-link-button', type: 'button', onClick: retry }, 'Could not load · Retry'))
            : !kpi.available
                ? h(React.Fragment, null, h('strong', { className: 'is-muted' }, 'No access'), h('span', null, 'Not part of your permissions'))
                : h(React.Fragment, null, h('strong', null, kpi.value), h('span', null, kpi.detail));
    return h('article', { className: `management-kpi is-${kpi.tone}`, 'aria-busy': state === 'loading' },
        h('span', { className: 'management-kpi__icon' }, h('i', { className: `bi ${kpi.icon}`, 'aria-hidden': true })),
        h('span', { className: 'management-kpi__copy' }, h('small', null, kpi.label), body));
}

// Placeholder cards while the first load runs, so the KPI row keeps its height.
const PLACEHOLDER_KPIS = [
    ['accounts', 'Active Accounts', 'bi-people-fill', 'blue'], ['signins', 'Successful Sign-ins', 'bi-box-arrow-in-right', 'green'],
    ['audit', 'Audit Events', 'bi-journal-text', 'purple'], ['assistance', 'Password Assistance', 'bi-key-fill', 'cyan'],
    ['alerts', 'Open System Alerts', 'bi-activity', 'amber'], ['backups', 'Last Successful Backup', 'bi-hdd-stack-fill', 'red'],
].map(([key, label, icon, tone]) => ({ key, label, icon, tone, available: true }));

function AttentionList({ items }) {
    if (!items.length) return h('p', { className: 'management-empty' }, 'No technical areas are part of your permissions.');
    return h('ul', { className: 'technical-attention' }, items.map(item => h('li', { key: item.key, className: item.count ? 'is-flagged' : 'is-clear' },
        h('span', { className: 'technical-attention__icon' }, h('i', { className: `bi ${item.count ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}`, 'aria-hidden': true })),
        h('span', { className: 'technical-attention__copy' }, h('strong', null, item.label), h('small', null, item.detail)),
        h('span', { className: 'technical-attention__count' }, item.count),
        h('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: item.href, 'aria-label': `Open ${item.label}` }, 'Open'))));
}

function Shortcuts({ session }) {
    const groups = navigationFor(session.roleName).filter(item => item.children && item.id !== 'account');
    return h('div', { className: 'technical-shortcuts' }, groups.map(group => {
        const pages = flattenNavigation([group]).filter(item => !item.children && canOpenPage(item, session));
        return pages.length ? h('section', { key: group.id },
            h('h3', null, h('i', { className: `bi ${group.icon}`, 'aria-hidden': true }), group.label),
            h('ul', null, pages.map(item => h('li', { key: item.id }, h('a', { href: item.href }, item.label, h('i', { className: 'bi bi-arrow-right', 'aria-hidden': true })))))) : null;
    }));
}

export function TechnicalDashboard({ session }) {
    const [query, setQuery] = React.useState(readQuery);
    const [refresh, setRefresh] = React.useState(0);
    React.useEffect(() => {
        const restore = () => setQuery(readQuery());
        window.addEventListener('popstate', restore);
        return () => window.removeEventListener('popstate', restore);
    }, []);
    const filters = { days: query.days };
    const source = useManagementSource(() => apiRequest(`${ENDPOINT}?${SOURCE.toQuery(filters)}`).then(response => response.data), { deps: [query.days, refresh] });
    const report = source.status === 'ready' ? source.data : null;
    const sections = new Map((report?.sections || []).map(section => [section.id, section]));
    const summary = sections.get('summary');
    const visibleTabs = TABS.filter(tab => !tab.sections.length || !report || tab.sections.some(id => sections.has(id)));
    const activeTab = visibleTabs.find(tab => tab.id === query.tab) || visibleTabs[0];

    function navigate(changes) {
        const next = { ...query, ...changes };
        const url = new URL(window.location.href);
        url.searchParams.delete('tab');
        url.searchParams.delete('days');
        if (next.tab !== 'overview') url.searchParams.set('tab', next.tab);
        if (next.days !== 30) url.searchParams.set('days', String(next.days));
        window.history.pushState(window.history.state, '', url);
        setQuery(next);
    }

    const loadedAt = React.useMemo(() => new Date(), [refresh, source.status === 'ready']);
    const gate = sectionGate([{ label: 'Technical activity', source }], { lines: 6 });
    const sectionCards = ids => gate || ids.filter(id => sections.has(id)).map(id => h(ReportSection, {
        key: id, section: sections.get(id), filters, canExport: true, source: SOURCE, numbered: false, emptyMessage: `No records in the last ${query.days} days.`,
    }));
    const omitted = report?.omitted_sections.filter(item => activeTab.sections.includes(item.id)) || [];

    const content = {
        overview: h(React.Fragment, null,
            h('div', { className: 'management-overview-grid management-overview-grid--split' },
                h(SectionCard, { title: 'Attention Required', description: `Items that may need follow-up, last ${query.days} days.` },
                    gate || h(AttentionList, { items: summary?.attention || [] })),
                h(SectionCard, { title: 'Administration Shortcuts', description: 'Functions available to your account.' }, h(Shortcuts, { session }))),
            sectionCards(['signins'])),
        reports: report ? h(ManagementReport, { filters, data: report, canExport: true, source: SOURCE, emptyMessage: `No records in the last ${query.days} days.` })
            : h('section', { className: 'management-card' }, gate),
    }[activeTab.id] || h(React.Fragment, null, sectionCards(activeTab.sections),
        omitted.length ? h('p', { className: 'technical-omitted', role: 'note' }, h('i', { className: 'bi bi-lock', 'aria-hidden': true }),
            ` Not shown because of access permissions: ${omitted.map(item => item.title).join(', ')}.`) : null);

    const kpis = summary?.kpis || PLACEHOLDER_KPIS;
    return h('div', { className: `app-shell management-dashboard technical-dashboard${activeTab.id === 'reports' ? ' management-dashboard--report' : ''}` },
        h(AppSidebar),
        h('main', { className: 'app-shell-main' }, h('div', { className: 'management-dashboard__content' },
            h('header', { className: 'management-dashboard__header' },
                h('div', { className: 'management-dashboard__heading' },
                    h(Breadcrumb, { trail: [activeTab.label] }),
                    h('h1', null, 'Technical Administration Dashboard'),
                    h('p', null, 'Monitor accounts, sign-in security, audit activity, system health and backups across SPDMS.'),
                    h('p', { className: 'management-dashboard__asof' }, h('i', { className: 'bi bi-clock-history', 'aria-hidden': true }),
                        report ? ` Data as of ${loadedAt.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}` : ' Loading the latest data…')),
                h('div', { className: 'management-dashboard__controls' },
                    h('label', null, h('span', null, 'Activity period'),
                        h('select', { value: query.days, disabled: source.status === 'loading', onChange: event => navigate({ days: Number(event.target.value) }) },
                            PERIODS.map(days => h('option', { key: days, value: days }, `Last ${days} days`)))),
                    h('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setRefresh(value => value + 1), disabled: source.status === 'loading', 'aria-label': 'Refresh dashboard data', title: 'Refresh dashboard data' },
                        h('i', { className: 'bi bi-arrow-clockwise', 'aria-hidden': true })))),
            h('section', { className: 'management-kpis', 'aria-label': 'Technical activity summary' },
                kpis.map(kpi => h(KpiCard, { key: kpi.key, kpi, state: source.status === 'ready' ? 'ready' : source.status, retry: source.retry }))),
            h('nav', { className: 'management-dashboard__tabs', 'aria-label': 'Dashboard sections' }, visibleTabs.map(tab => h('button', {
                key: tab.id, type: 'button', className: `management-dashboard__tab${activeTab.id === tab.id ? ' is-active' : ''}`,
                'aria-current': activeTab.id === tab.id ? 'page' : undefined, onClick: () => navigate({ tab: tab.id }),
            }, h('i', { className: `bi ${tab.icon}`, 'aria-hidden': true }), tab.label))),
            h('section', { className: 'management-dashboard__panel', 'aria-label': activeTab.label }, content),
            h('footer', { className: 'management-dashboard__footer' }, '© 2026 Strategic Planning Management System. All rights reserved.'))));
}
