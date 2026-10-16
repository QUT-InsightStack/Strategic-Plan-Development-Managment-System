import { AdministrativeAdminSidebar } from '../../components/AdministrativeAdminSidebar.js';
import { AdministrativeActionMenu } from '../../components/AdministrativeActionMenu.js';
import { PageHeader } from '../../components/PageHeader.js';
import { FilterBar, FilterSearch, FilterSelect } from '../../components/FilterBar.js';
import { AppDialog } from '../../components/AppDialog.js';
import { apiRequest } from '../../api/api-client.js';
import { can, getAccessSession } from '../../access/access-session.js';
import { PERMISSIONS } from '../../access/access-policy.js';

const { useMemo, useState, useEffect } = React;

const STATUS_LABELS = { active: 'Active', archived: 'Archived', deleted: 'Deleted', inactive: 'Inactive' };
const STATUS_BADGES = { active: 'success', archived: 'archived', inactive: 'neutral' };

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

function ReferenceDataTable({
    rows,
    loading,
    canManage,
    canArchive,
    canDelete,
    onReview,
    onUpdate,
    onArchive,
    onDelete,
}) {
    const canDeleteActive = [
        'Technical Administrator',
        'Technical Admin',
        'Management',
'Executive',
'Management / Executive',
'Division Head',
    ].includes(getAccessSession()?.roleName);
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
                        ...(canDelete &&
row.status !== 'deleted' &&
(row.status === 'archived' || canDeleteActive) ? [{ label: 'Delete', icon: 'bi-trash3-fill', tone: 'danger', onSelect: () => onDelete(row) }] : []),
                    ] }))
                )) : null
            )
        )
    );
}

export function ReferenceDataManagementApp() {
    const sidebarActive = 'Agenda';
    const accessSession = getAccessSession();
    const canManageAgenda = can(PERMISSIONS.PRESIDENTIAL_AGENDA_MANAGE, accessSession);
    const canArchiveAgenda = can(PERMISSIONS.PRESIDENTIAL_AGENDA_ARCHIVE, accessSession);
    const canDeleteAgenda = can(PERMISSIONS.PRESIDENTIAL_AGENDA_DELETE, accessSession);
    const [filters, setFilters] = useState({ status: '', search: '' });
    const [notice, setNotice] = useState({ type: '', message: '' });
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [page, setPage] = useState(1);
    const [confirmDialog, setConfirmDialog] = useState({ open: false, variant: 'danger', title: '', message: '', row: null, action: null });

    const visibleRows = useMemo(() => rows, [rows]);

    async function loadAgenda(nextPage = page, activeFilters = filters) {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                page: String(nextPage),
                per_page: '10',
                status: activeFilters.status || 'all',
                search: activeFilters.search.trim(),
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

    useEffect(() => { loadAgenda(1); }, []);

    function clearFilters() {
        const cleared = { status: '', search: '' };
        setFilters(cleared);
        setPage(1);
        loadAgenda(1, cleared);
    }

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
            message: `Delete “${row.title}” (${row.code})? It will no longer be available for active use. The record and existing references and history will be retained.`,
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

    function addItem() {
        window.location.href = '/administrative-admin/reference-data/agenda/create';
    }

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
                React.createElement(FilterBar, { label: 'Filter presidential agenda', busy: loading, onSubmit: () => { setPage(1); loadAgenda(1); }, onClear: clearFilters },
                    React.createElement(FilterSearch, { id: 'agenda-search', label: 'Search', value: filters.search, placeholder: 'Search presidential agenda…', onChange: (search) => setFilters((current) => ({ ...current, search })) }),
                    React.createElement(FilterSelect, { id: 'agenda-status', label: 'Status', value: filters.status, allLabel: 'All statuses', options: [['active', 'Active'], ['archived', 'Archived'], ['inactive', 'Inactive']], onChange: (status) => setFilters((current) => ({ ...current, status })) })
                ),
                React.createElement('section', { className: 'ui-card reference-workspace', 'aria-label': 'Presidential agenda workspace' },
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
                )
            )
        )
    );
}
