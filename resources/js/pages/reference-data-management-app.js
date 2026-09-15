import { AdministrativeAdminSidebar } from '../components/AdministrativeAdminSidebar.js';
import { AdministrativeActionMenu } from '../components/AdministrativeActionMenu.js';
import { PageHeader } from '../components/PageHeader.js';
import { AppDialog } from '../components/AppDialog.js';

const { useMemo, useState } = React;

const STATUS_LABELS = { active: 'Active', archived: 'Archived', inactive: 'Inactive' };
const STATUS_BADGES = { active: 'success', archived: 'archived', inactive: 'neutral' };

const tabs = [
    { id: 'agenda', label: 'Presidential Agenda', icon: 'bi-bank2' },
    { id: 'pdp', label: 'PDP Chapters', icon: 'bi-journal-text' },
    { id: 'priority', label: 'DOST Priority Areas', icon: 'bi-building-fill' },
    { id: 'indicator', label: 'Indicator Types', icon: 'bi-speedometer2' },
];

const agendaRows = [
    { id: 'PA-08', title: 'Improve R&D capacity', date: '10/06/2024', note: 'Strengthen national research capability.', status: 'active' },
    { id: 'PA-09', title: 'Enhance STI infrastructure', date: '10/08/2024', note: 'Expand shared science and technology facilities.', status: 'inactive' },
    { id: 'PA-10', title: 'Promote Technology Adoption', date: '10/06/2024', note: 'Accelerate adoption across priority industries.', status: 'active' },
    { id: 'PA-11', title: 'Strengthen collaboration', date: '10/06/2024', note: 'Build stronger research and industry partnerships.', status: 'active' },
];

function ReferenceDataTable({ rows, loading, onReview, onUpdate, onArchive, onDelete }) {
    return React.createElement('div', { className: 'ui-table-wrap reference-table-wrap' },
        React.createElement('table', { className: 'ui-table reference-table' },
            React.createElement('caption', { className: 'ui-visually-hidden' }, 'Presidential Agenda reference data'),
            React.createElement('thead', null, React.createElement('tr', null,
                ['Agenda ID', 'Agenda Title', 'Effective Date', 'Note', 'Status', 'Action'].map((heading) => React.createElement('th', { key: heading, scope: 'col' }, heading))
            )),
            React.createElement('tbody', null,
                loading ? React.createElement('tr', null, React.createElement('td', { colSpan: 6, className: 'ui-empty' }, 'Loading reference data…')) : null,
                !loading && rows.length === 0 ? React.createElement('tr', null, React.createElement('td', { colSpan: 6, className: 'ui-empty' }, 'No reference-data records match the current filters.')) : null,
                !loading ? rows.map((row) => React.createElement('tr', { key: row.id },
                    React.createElement('td', null, React.createElement('strong', null, row.id)),
                    React.createElement('td', null, row.title),
                    React.createElement('td', null, row.date),
                    React.createElement('td', { className: 'reference-note' }, row.note),
                    React.createElement('td', null, React.createElement('span', { className: `ui-badge ui-badge--${STATUS_BADGES[row.status] || 'neutral'}` }, STATUS_LABELS[row.status] || 'Inactive')),
                    React.createElement('td', { className: 'reference-action-cell' }, React.createElement(AdministrativeActionMenu, { actions: [
                        { label: 'Review', icon: 'bi-eye-fill', onSelect: () => onReview(row) },
                        { label: 'Update', icon: 'bi-pencil-fill', onSelect: () => onUpdate(row) },
                        { label: 'Archive', icon: 'bi-archive-fill', onSelect: () => onArchive(row) },
                        { label: 'Delete', icon: 'bi-trash3-fill', tone: 'danger', onSelect: () => onDelete(row) },
                    ] }))
                )) : null
            )
        )
    );
}

export function ReferenceDataManagementApp() {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    const initialTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : 'agenda';
    const sidebarActive = requestedTab === 'agenda' ? 'Presidential Agenda' : 'Reference Data';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [filters, setFilters] = useState({ status: '', time: '', search: '' });
    const [notice, setNotice] = useState({ type: '', message: '' });

    /*
     * Presidential Agenda rows are still the design data set: this page has no
     * agenda API yet. Holding them in state lets the archive action behave
     * correctly in the interface; swapping agendaRows for a fetch, and the
     * archive below for a request, is all that is needed once the endpoint
     * exists.
     */
    const [rows, setRows] = useState(agendaRows);
    const [confirmDialog, setConfirmDialog] = useState({ open: false, variant: 'danger', title: '', message: '', row: null, action: null });

    const visibleRows = useMemo(() => {
        if (activeTab !== 'agenda') return [];
        const term = filters.search.trim().toLowerCase();
        return rows.filter((row) =>
            (!filters.status || row.status === filters.status) &&
            (!term || `${row.id} ${row.title} ${row.note}`.toLowerCase().includes(term))
        );
    }, [activeTab, filters, rows]);

    function closeConfirmDialog() {
        setConfirmDialog((current) => ({ ...current, open: false }));
    }

    function requestArchive(row) {
        if (row.status === 'archived') {
            setNotice({ type: 'info', message: `${row.id} is already archived.` });
            return;
        }

        setConfirmDialog({
            open: true,
            variant: 'danger',
            title: 'Archive Presidential Agenda?',
            message: `Archive \u201C${row.title}\u201D (${row.id})? It will no longer be offered as an active agenda item, and the record is kept for historical reference.`,
            row,
            action: 'archive',
        });
    }

    function confirmArchive() {
        const target = confirmDialog.row;

        closeConfirmDialog();
        setRows((current) => current.map((row) => (row.id === target.id ? { ...row, status: 'archived' } : row)));
        setNotice({ type: 'success', message: `${target.id} archived successfully.` });
    }

    function chooseTab(tab) {
        setActiveTab(tab.id);
        setFilters({ status: '', time: '', search: '' });
        setNotice(tab.id === 'agenda'
            ? { type: '', message: '' }
            : { type: 'info', message: `${tab.label} is preserved as a design tab and will use its dedicated data source when the backend module is approved.` });
    }

    function addItem() {
        if (activeTab === 'agenda') {
            window.location.href = '/administrative-admin/reference-data/agenda/create';
            return;
        }

        setNotice({ type: 'info', message: `${tabs.find((tab) => tab.id === activeTab)?.label} requires backend approval before its item form can be connected.` });
    }

    return React.createElement(React.Fragment, null,
        React.createElement(AdministrativeAdminSidebar, { active: sidebarActive, onNotice: (message) => setNotice({ type: 'info', message }) }),
        React.createElement(AppDialog, {
            open: confirmDialog.open,
            variant: confirmDialog.variant,
            title: confirmDialog.title,
            message: confirmDialog.message,
            confirmLabel: confirmDialog.action === 'archive' ? 'Confirm Archive' : 'Close',
            onConfirm: confirmDialog.action === 'archive' ? confirmArchive : closeConfirmDialog,
            onCancel: closeConfirmDialog,
        }),
        React.createElement('main', { className: 'app-shell-main reference-data-page' },
            React.createElement('div', { className: 'app-shell-container' },
                React.createElement(PageHeader, {
                    section: 'Administration',
                    title: 'Reference Data Management',
                    subtitle: 'Control background data used across the system for mapping, filtering, reporting, and maintaining consistency.',
                }),
                notice.message ? React.createElement('div', { className: `ui-status ui-status--${notice.type} reference-notice`, role: 'status' }, notice.message) : null,
                React.createElement('section', { className: 'ui-card reference-workspace', 'aria-label': 'Reference data workspace' },
                    React.createElement('div', { className: 'reference-tabs', role: 'tablist', 'aria-label': 'Reference data categories' },
                        tabs.map((tab) => React.createElement('button', {
                            key: tab.id,
                            className: `reference-tab${activeTab === tab.id ? ' active' : ''}`,
                            type: 'button',
                            role: 'tab',
                            'aria-selected': activeTab === tab.id,
                            onClick: () => chooseTab(tab),
                        }, React.createElement('i', { className: `bi ${tab.icon}`, 'aria-hidden': 'true' }), tab.label))
                    ),
                    React.createElement('div', { className: 'reference-filter-row' },
                        React.createElement('select', { className: 'ui-select', 'aria-label': 'Filter by status', value: filters.status, onChange: (event) => setFilters((current) => ({ ...current, status: event.target.value })) },
                            React.createElement('option', { value: '' }, 'All Status'),
                            React.createElement('option', { value: 'active' }, 'Active'),
                            React.createElement('option', { value: 'archived' }, 'Archived'),
                            React.createElement('option', { value: 'inactive' }, 'Inactive')
                        ),
                        React.createElement('select', { className: 'ui-select', 'aria-label': 'Filter by time', value: filters.time, onChange: (event) => setFilters((current) => ({ ...current, time: event.target.value })) },
                            React.createElement('option', { value: '' }, 'Time'),
                            React.createElement('option', { value: '2024' }, '2024')
                        ),
                        React.createElement('div', { className: 'reference-search' },
                            React.createElement('i', { className: 'bi bi-search', 'aria-hidden': 'true' }),
                            React.createElement('input', { className: 'ui-input', value: filters.search, placeholder: `Search ${tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()}…`, 'aria-label': 'Search reference data', onChange: (event) => setFilters((current) => ({ ...current, search: event.target.value })) })
                        ),
                        React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm reference-filter-button', type: 'button', onClick: () => setNotice({ type: 'success', message: 'Filters applied.' }) }, React.createElement('i', { className: 'bi bi-funnel' }), 'Filter')
                    ),
                    React.createElement('div', { className: 'reference-add-row' },
                        React.createElement('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', onClick: addItem }, React.createElement('i', { className: 'bi bi-plus-lg' }), activeTab === 'agenda' ? 'Add Agenda Item' : `Add ${tabs.find((tab) => tab.id === activeTab)?.label}`)
                    ),
                    React.createElement(ReferenceDataTable, {
                        rows: visibleRows,
                        loading: false,
                        onReview: (row) => { window.location.href = `/administrative-admin/reference-data/agenda/${encodeURIComponent(row.id)}/edit?mode=review`; },
                        onUpdate: (row) => { window.location.href = `/administrative-admin/reference-data/agenda/${encodeURIComponent(row.id)}/edit`; },
                        onArchive: requestArchive,
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
                    React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: () => { setFilters({ status: '', time: '', search: '' }); setNotice({ type: '', message: '' }); } }, 'Cancel'),
                    React.createElement('button', { className: 'ui-button ui-button--danger', type: 'button', disabled: true, title: 'Select records before deleting' }, 'Delete')
                )
            )
        )
    );
}
