import { AdministrativeAdminSidebar } from '../../components/AdministrativeAdminSidebar.js';
import { AdministrativeActionMenu } from '../../components/AdministrativeActionMenu.js';
import { PageHeader } from '../../components/PageHeader.js';
import { AppDialog } from '../../components/AppDialog.js';
import { apiRequest } from '../../api/api-client.js';
import { can, getAccessSession } from '../../access/access-session.js';
import { PERMISSIONS } from '../../access/access-policy.js';

const { useMemo, useState, useEffect } = React;

const STATUS_LABELS = { active: 'Active', archived: 'Archived', deleted: 'Deleted', inactive: 'Inactive' };
const STATUS_BADGES = { active: 'success', archived: 'archived', inactive: 'neutral' };

const tabs = [
    { id: 'agenda', label: 'Presidential Agenda', icon: 'bi-bank2' },
    { id: 'pdp', label: 'PDP Chapters', icon: 'bi-journal-text' },
];

function agendaRow(item) {
    return {
        id: item.agenda_id,
        code: item.code,
        title: item.title,
        date: item.effective_date || '',
        note: [item.description, item.note].filter(Boolean).join(' · '),
        status: item.status,
    };
}

function ReferenceDataTable({ rows, loading, canManage, canArchive, canDelete, onReview, onUpdate, onArchive, onDelete }) {
    return React.createElement('div', { className: 'ui-table-wrap reference-table-wrap' },
        React.createElement('table', { className: 'ui-table reference-table' },
            React.createElement('caption', { className: 'ui-visually-hidden' }, 'Presidential Agenda reference data'),
            React.createElement('thead', null, React.createElement('tr', null,
                ['Agenda Code', 'Agenda Title', 'Description / Note', 'Effective Date', 'Status', 'Action'].map((heading) => React.createElement('th', { key: heading, scope: 'col' }, heading))
            )),
            React.createElement('tbody', null,
                loading ? React.createElement('tr', null, React.createElement('td', { colSpan: 6, className: 'ui-empty' }, 'Loading reference data…')) : null,
                !loading && rows.length === 0 ? React.createElement('tr', null, React.createElement('td', { colSpan: 6, className: 'ui-empty' }, 'No reference-data records match the current filters.')) : null,
                !loading ? rows.map((row) => React.createElement('tr', { key: row.id },
                    React.createElement('td', null, React.createElement('strong', null, row.code)),
                    React.createElement('td', null, row.title),
                    React.createElement('td', null, row.date),
                    React.createElement('td', { className: 'reference-note' }, row.note),
                    React.createElement('td', null, React.createElement('span', { className: `ui-badge ui-badge--${STATUS_BADGES[row.status] || 'neutral'}` }, STATUS_LABELS[row.status] || 'Inactive')),
                    React.createElement('td', { className: 'reference-action-cell' }, React.createElement(AdministrativeActionMenu, { actions: [
                        { label: 'Review', icon: 'bi-eye-fill', onSelect: () => onReview(row) },
                        ...(canManage && row.status !== 'archived' ? [{ label: 'Update', icon: 'bi-pencil-fill', onSelect: () => onUpdate(row) }] : []),
                        ...(canArchive && row.status !== 'archived' ? [{ label: 'Archive', icon: 'bi-archive-fill', onSelect: () => onArchive(row) }] : []),
                        ...(canDelete && row.status === 'archived' ? [{ label: 'Delete', icon: 'bi-trash3-fill', tone: 'danger', onSelect: () => onDelete(row) }] : []),
                    ] }))
                )) : null
            )
        )
    );
}

function ReferenceCatalogPage() {
    const liveLists = [
        { title: 'Presidential Agenda', description: 'Agenda records used to align strategic objectives.', source: 'tblpresidential_agenda_items', href: '/administrative-admin/reference-data?tab=agenda', icon: 'bi-bank2', action: 'Manage Agenda' },
        { title: 'PDP Chapters', description: 'PDP chapter records used in strategic objective mapping.', source: 'tblpdp_chapters', href: '/pdp-chapters/manage', icon: 'bi-journal-text', action: 'Manage Chapters' },
    ];
    const unavailableLists = [
        { title: 'DOST Priority Areas', description: 'Maintain the priority areas available for strategic planning and alignment.', icon: 'bi-building-fill' },
        { title: 'Indicator Types', description: 'Maintain the indicator types available when defining objective measures.', icon: 'bi-speedometer2' },
    ];

    return React.createElement(React.Fragment, null,
        React.createElement(AdministrativeAdminSidebar, { active: 'Reference Data' }),
        React.createElement('main', { className: 'app-shell-main reference-data-page' },
            React.createElement('div', { className: 'app-shell-container' },
                React.createElement(PageHeader, {
                    section: 'Administrative Administration',
                    title: 'Reference Data',
                    subtitle: 'Open the maintained reference lists used throughout strategic planning.',
                }),
                React.createElement('section', { className: 'reference-catalog-grid', 'aria-label': 'Available reference data' },
                    liveLists.map((card) => React.createElement('article', { className: 'ui-card reference-catalog-card', key: card.title },
                        React.createElement('i', { className: `bi ${card.icon}`, 'aria-hidden': 'true' }),
                        React.createElement('h2', null, card.title),
                        React.createElement('p', null, card.description),
                        React.createElement('code', null, card.source),
                        React.createElement('a', { className: 'ui-button ui-button--primary ui-button--sm', href: card.href }, card.action)
                    )),
                    unavailableLists.map((list) => React.createElement('article', { className: 'ui-card reference-catalog-card reference-catalog-card--unavailable', key: list.title },
                        React.createElement('i', { className: `bi ${list.icon}`, 'aria-hidden': 'true' }),
                        React.createElement('h2', null, list.title),
                        React.createElement('p', null, list.description),
                        React.createElement('p', { className: 'reference-catalog-empty' }, 'No records to display.'),
                        React.createElement('span', { className: 'ui-badge ui-badge--neutral' }, 'Data connection pending')
                    ))
                )
            )
        )
    );
}

export function ReferenceDataManagementApp() {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    const initialTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : 'agenda';
    const sidebarActive = 'Agenda';
    const accessSession = getAccessSession();
    const canManageAgenda = can(PERMISSIONS.PRESIDENTIAL_AGENDA_MANAGE, accessSession);
    const canArchiveAgenda = can(PERMISSIONS.PRESIDENTIAL_AGENDA_ARCHIVE, accessSession);
    const canDeleteAgenda = can(PERMISSIONS.PRESIDENTIAL_AGENDA_DELETE, accessSession);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [filters, setFilters] = useState({ status: '', search: '' });
    const [notice, setNotice] = useState({ type: '', message: '' });
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [page, setPage] = useState(1);
    const [confirmDialog, setConfirmDialog] = useState({ open: false, variant: 'danger', title: '', message: '', row: null, action: null });

    const visibleRows = useMemo(() => rows, [rows]);

    async function loadAgenda(nextPage = page) {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                page: String(nextPage),
                per_page: '10',
                status: filters.status || 'all',
                search: filters.search.trim(),
            });
            const payload = await apiRequest(`/api/presidential-agenda?${query}`);
            setRows((payload.data || []).map(agendaRow));
            setMeta(payload.meta || { current_page: nextPage, last_page: 1, total: 0 });
            setNotice({ type: '', message: '' });
        } catch (error) {
            setRows([]);
            setNotice({ type: 'error', message: error.message });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { if (requestedTab !== 'reference') loadAgenda(1); }, []);

    function closeConfirmDialog() {
        setConfirmDialog((current) => ({ ...current, open: false }));
    }

    function requestArchive(row) {
        if (row.status === 'archived') {
            setNotice({ type: 'info', message: `${row.code} is already archived.` });
            return;
        }

        setConfirmDialog({
            open: true,
            variant: 'danger',
            title: 'Archive Presidential Agenda?',
            message: `Archive \u201C${row.title}\u201D (${row.code})? It will no longer be offered as an active agenda item, and the record is kept for historical reference.`,
            row,
            action: 'archive',
        });
    }

    async function confirmArchive() {
        const target = confirmDialog.row;
        closeConfirmDialog();
        try {
            const payload = await apiRequest(`/api/presidential-agenda/${target.id}/archive`, { method: 'PATCH' });
            setNotice({ type: 'success', message: payload.message || `${target.code} archived successfully.` });
            await loadAgenda(page);
        } catch (error) { setNotice({ type: 'error', message: error.message }); }
    }

    function requestDelete(row) {
        setConfirmDialog({
            open: true,
            variant: 'danger',
            title: 'Delete Presidential Agenda?',
            message: `Delete \u201C${row.title}\u201D (${row.code})? Only archived items can be deleted. The record is retained so existing references and history stay intact.`,
            row,
            action: 'delete',
        });
    }

    async function confirmDelete() {
        const target = confirmDialog.row;
        closeConfirmDialog();
        try {
            const payload = await apiRequest(`/api/presidential-agenda/${target.id}`, { method: 'DELETE' });
            setNotice({ type: 'success', message: payload.message || `${target.code} deleted successfully.` });
            await loadAgenda(page);
        } catch (error) { setNotice({ type: 'error', message: error.message }); }
    }

    function chooseTab(tab) {
        setActiveTab(tab.id);
        setFilters({ status: '', search: '' });
        setNotice({ type: '', message: '' });
        if (tab.id === 'pdp') window.location.href = '/pdp-chapters/manage';
    }

    function addItem() {
        if (activeTab === 'agenda') {
            window.location.href = '/administrative-admin/reference-data/agenda/create';
            return;
        }

        setNotice({ type: 'info', message: `${tabs.find((tab) => tab.id === activeTab)?.label} is managed in its own module.` });
    }

    if (requestedTab === 'reference') return React.createElement(ReferenceCatalogPage);

    return React.createElement(React.Fragment, null,
        React.createElement(AdministrativeAdminSidebar, { active: sidebarActive, onNotice: (message) => setNotice({ type: 'info', message }) }),
        React.createElement(AppDialog, {
            open: confirmDialog.open,
            variant: confirmDialog.variant,
            title: confirmDialog.title,
            message: confirmDialog.message,
            confirmLabel: confirmDialog.action === 'archive' ? 'Confirm Archive' : confirmDialog.action === 'delete' ? 'Confirm Delete' : 'Close',
            onConfirm: confirmDialog.action === 'archive' ? confirmArchive : confirmDialog.action === 'delete' ? confirmDelete : closeConfirmDialog,
            onCancel: closeConfirmDialog,
        }),
        React.createElement('main', { className: 'app-shell-main reference-data-page' },
            React.createElement('div', { className: 'app-shell-container' },
                React.createElement(PageHeader, {
                    section: 'Administration',
                    title: 'Presidential Agenda Management',
                    subtitle: 'Maintain agenda records used to align strategic objectives. Records and actions are loaded from the system database.',
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
                        React.createElement('div', { className: 'reference-search' },
                            React.createElement('i', { className: 'bi bi-search', 'aria-hidden': 'true' }),
                            React.createElement('input', { className: 'ui-input', value: filters.search, placeholder: `Search ${tabs.find((tab) => tab.id === activeTab)?.label.toLowerCase()}…`, 'aria-label': 'Search reference data', onChange: (event) => setFilters((current) => ({ ...current, search: event.target.value })) })
                        ),
                        React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm reference-filter-button', type: 'button', onClick: () => { setPage(1); loadAgenda(1); } }, React.createElement('i', { className: 'bi bi-funnel' }), 'Filter')
                    ),
                    React.createElement('div', { className: 'reference-add-row' },
                        canManageAgenda ? React.createElement('button', { className: 'ui-button ui-button--primary ui-button--sm', type: 'button', onClick: addItem }, React.createElement('i', { className: 'bi bi-plus-lg' }), 'Add Agenda Item') : null
                    ),
                    React.createElement(ReferenceDataTable, {
                        rows: visibleRows,
                        loading,
                        canManage: canManageAgenda,
                        canArchive: canArchiveAgenda,
                        canDelete: canDeleteAgenda,
                        onReview: (row) => { window.location.href = `/administrative-admin/reference-data/agenda/${row.id}/edit?mode=review`; },
                        onUpdate: (row) => { window.location.href = `/administrative-admin/reference-data/agenda/${row.id}/edit`; },
                        onArchive: requestArchive,
                        onDelete: requestDelete,
                    }),
                    React.createElement('footer', { className: 'reference-table-footer' },
                            React.createElement('span', null, `${meta.total} record(s) · Page ${meta.current_page} of ${meta.last_page}`),
                        React.createElement('div', { className: 'ui-pagination__actions' },
                            React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: loading || meta.current_page <= 1, 'aria-label': 'Previous page', onClick: () => { const next = meta.current_page - 1; setPage(next); loadAgenda(next); } }, React.createElement('i', { className: 'bi bi-chevron-left' })),
                            React.createElement('span', { className: 'reference-current-page', 'aria-current': 'page' }, meta.current_page),
                            React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: loading || meta.current_page >= meta.last_page, 'aria-label': 'Next page', onClick: () => { const next = meta.current_page + 1; setPage(next); loadAgenda(next); } }, React.createElement('i', { className: 'bi bi-chevron-right' }))
                        )
                    )
                ),
                React.createElement('div', { className: 'reference-page-actions' },
                    React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: () => { setFilters({ status: '', search: '' }); setPage(1); loadAgenda(1); } }, 'Clear filters')
                )
            )
        )
    );
}
