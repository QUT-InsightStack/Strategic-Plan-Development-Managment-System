import { AdministrativeAdminSidebar } from '../../components/AdministrativeAdminSidebar.js';
import { AdministrativeActionMenu } from '../../components/AdministrativeActionMenu.js';
import { PageHeader } from '../../components/PageHeader.js';

const { useMemo, useState } = React;

const templateTabs = [
    { id: 'strategic-plan', label: 'Strategic Plan', icon: 'bi-bank2' },
    { id: 'report', label: 'Report', icon: 'bi-pie-chart-fill' },
    { id: 'progress-update', label: 'Progress Update', icon: 'bi-calendar3' },
    { id: 'approval-form', label: 'Approval Form', icon: 'bi-speedometer2' },
];

const templateRows = [
    { id: 'TPL-01', name: 'Strategic Plan Template', updated: '05/02/2026', version: 'v1.0', status: 'active', category: 'strategic-plan' },
    { id: 'TPL-02', name: 'Annual Report Template', updated: '05/02/2026', version: 'v1.1', status: 'inactive', category: 'report' },
    { id: 'TPL-03', name: 'Progress Update Template', updated: '05/02/2026', version: 'v2.0', status: 'active', category: 'progress-update' },
    { id: 'TPL-04', name: 'Approval Memo Template', updated: '05/02/2026', version: 'v1.0', status: 'active', category: 'approval-form' },
];

function TemplateTable({ rows, onArchive, onDelete }) {
    return React.createElement('div', { className: 'ui-table-wrap reference-table-wrap' },
        React.createElement('table', { className: 'ui-table reference-table template-table' },
            React.createElement('caption', { className: 'ui-visually-hidden' }, 'Planning templates'),
            React.createElement('thead', null, React.createElement('tr', null,
                ['Template ID', 'Template Name', 'Updated', 'Version', 'Status', 'Action'].map((heading) => React.createElement('th', { key: heading, scope: 'col' }, heading))
            )),
            React.createElement('tbody', null,
                rows.length === 0 ? React.createElement('tr', null, React.createElement('td', { className: 'ui-empty', colSpan: 6 }, 'No templates match the current category and filters.')) : null,
                rows.map((row) => React.createElement('tr', { key: row.id },
                    React.createElement('td', null, React.createElement('strong', null, row.id)),
                    React.createElement('td', null, row.name),
                    React.createElement('td', null, row.updated),
                    React.createElement('td', null, row.version),
                    React.createElement('td', null, React.createElement('span', { className: `ui-badge ui-badge--${row.status === 'active' ? 'success' : 'neutral'}` }, row.status === 'active' ? 'Active' : 'Inactive')),
                    React.createElement('td', { className: 'reference-action-cell' }, React.createElement(AdministrativeActionMenu, { actions: [
                        { label: 'Review', icon: 'bi-eye-fill', onSelect: () => { window.location.href = `/administrative-admin/templates/${encodeURIComponent(row.id)}/edit?mode=review`; } },
                        { label: 'Update', icon: 'bi-pencil-fill', onSelect: () => { window.location.href = `/administrative-admin/templates/${encodeURIComponent(row.id)}/edit`; } },
                        { label: 'Archive', icon: 'bi-archive-fill', onSelect: () => onArchive(row) },
                        { label: 'Delete', icon: 'bi-trash3-fill', tone: 'danger', onSelect: () => onDelete(row) },
                    ] }))
                ))
            )
        )
    );
}

export function TemplateManagementApp() {
    const [activeTab, setActiveTab] = useState('strategic-plan');
    const [filters, setFilters] = useState({ status: '', time: '', search: '' });
    const [notice, setNotice] = useState({ type: '', message: '' });

    const visibleRows = useMemo(() => {
        const term = filters.search.trim().toLowerCase();
        return templateRows.filter((row) =>
            row.category === activeTab &&
            (!filters.status || row.status === filters.status) &&
            (!term || `${row.id} ${row.name} ${row.version}`.toLowerCase().includes(term))
        );
    }, [activeTab, filters]);

    function resetFilters() {
        setFilters({ status: '', time: '', search: '' });
        setNotice({ type: '', message: '' });
    }

    return React.createElement(React.Fragment, null,
        React.createElement(AdministrativeAdminSidebar, { active: 'Templates', onNotice: (message) => setNotice({ type: 'info', message }) }),
        React.createElement('main', { className: 'app-shell-main reference-data-page' },
            React.createElement('div', { className: 'app-shell-container' },
                React.createElement(PageHeader, {
                    section: 'Administration',
                    title: 'Template Management',
                    subtitle: 'Control reusable planning templates used across the system for consistent reporting, progress updates, and approvals.',
                }),
                notice.message ? React.createElement('div', { className: `ui-status ui-status--${notice.type} reference-notice`, role: 'status' }, notice.message) : null,
                React.createElement('section', { className: 'ui-card reference-workspace', 'aria-label': 'Template management workspace' },
                    React.createElement('div', { className: 'reference-tabs', role: 'tablist', 'aria-label': 'Template categories' },
                        templateTabs.map((tab) => React.createElement('button', {
                            key: tab.id,
                            className: `reference-tab${activeTab === tab.id ? ' active' : ''}`,
                            type: 'button',
                            role: 'tab',
                            'aria-selected': activeTab === tab.id,
                            onClick: () => { setActiveTab(tab.id); setNotice({ type: '', message: '' }); },
                        }, React.createElement('i', { className: `bi ${tab.icon}`, 'aria-hidden': 'true' }), tab.label))
                    ),
                    React.createElement('div', { className: 'reference-filter-row' },
                        React.createElement('select', { className: 'ui-select', 'aria-label': 'Filter templates by status', value: filters.status, onChange: (event) => setFilters((current) => ({ ...current, status: event.target.value })) },
                            React.createElement('option', { value: '' }, 'All Status'),
                            React.createElement('option', { value: 'active' }, 'Active'),
                            React.createElement('option', { value: 'inactive' }, 'Inactive')
                        ),
                        React.createElement('select', { className: 'ui-select', 'aria-label': 'Filter templates by time', value: filters.time, onChange: (event) => setFilters((current) => ({ ...current, time: event.target.value })) },
                            React.createElement('option', { value: '' }, 'Time'),
                            React.createElement('option', { value: '2026' }, '2026')
                        ),
                        React.createElement('div', { className: 'reference-search' },
                            React.createElement('i', { className: 'bi bi-search', 'aria-hidden': 'true' }),
                            React.createElement('input', { className: 'ui-input', value: filters.search, placeholder: 'Search templates…', 'aria-label': 'Search templates', onChange: (event) => setFilters((current) => ({ ...current, search: event.target.value })) })
                        ),
                        React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm reference-filter-button', type: 'button', onClick: () => setNotice({ type: 'success', message: 'Template filters applied.' }) }, React.createElement('i', { className: 'bi bi-funnel' }), 'Filter')
                    ),
                    React.createElement('div', { className: 'reference-add-row' },
                        React.createElement('a', { className: 'ui-button ui-button--primary ui-button--sm', href: '/administrative-admin/templates/create' }, React.createElement('i', { className: 'bi bi-plus-lg' }), 'Add Template')
                    ),
                    React.createElement(TemplateTable, {
                        rows: visibleRows,
                        onArchive: (row) => setNotice({ type: 'info', message: `Archive for ${row.id} requires the approved backend archive endpoint.` }),
                        onDelete: (row) => setNotice({ type: 'info', message: `Delete for ${row.id} requires backend approval and a confirmation workflow.` }),
                    }),
                    React.createElement('footer', { className: 'reference-table-footer' },
                        React.createElement('span', null, `0 of ${visibleRows.length} row(s) selected.`),
                        React.createElement('div', { className: 'ui-pagination__actions' },
                            React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: true, 'aria-label': 'Previous page' }, React.createElement('i', { className: 'bi bi-chevron-left' })),
                            React.createElement('span', { className: 'reference-current-page', 'aria-current': 'page' }, '1'),
                            React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: true, 'aria-label': 'Next page' }, React.createElement('i', { className: 'bi bi-chevron-right' }))
                        )
                    )
                ),
                React.createElement('div', { className: 'reference-page-actions' },
                    React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: resetFilters }, 'Cancel'),
                    React.createElement('button', { className: 'ui-button ui-button--danger', type: 'button', disabled: true, title: 'Select templates before deleting' }, 'Delete')
                )
            )
        )
    );
}
