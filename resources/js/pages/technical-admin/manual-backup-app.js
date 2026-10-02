import { mountProtectedPage } from '../../access/mount-protected-page.js';
import { PERMISSIONS } from '../../access/access-policy.js';
import { can, getAccessSession } from '../../access/access-session.js';
import { createBackup, downloadBackup, listBackups, restoreBackup } from '../../api/backups-api.js';
import { logout } from '../../auth-session.js';
import { AppDialog } from '../../components/AppDialog.js';
import { PageHeader } from '../../components/PageHeader.js';
import { TechnicalAdminSidebar } from '../../components/TechnicalAdminSidebar.js';


const { useEffect, useState } = React;

function formatTimestamp(value) {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString(undefined, {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function ManualBackupApp() {
    const accessSession = getAccessSession();
    const canCreate = can(PERMISSIONS.BACKUPS_CREATE, accessSession);
    const canDownload = can(PERMISSIONS.BACKUPS_DOWNLOAD, accessSession);
    const canRestore = can(PERMISSIONS.BACKUPS_RESTORE, accessSession);

    const [backups, setBackups] = useState([]);
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    // Separate from `loading` so the table does not disappear while a backup
    // runs, and so the button can show its own progress.
    const [creating, setCreating] = useState(false);
    const [downloadingId, setDownloadingId] = useState(null);
    const [restoringId, setRestoringId] = useState(null);
    const [notice, setNotice] = useState({ type: '', message: '' });
    // One dialog serves the create confirmation, the restore confirmation and
    // the sign-out notice that has to follow a restore.
    const [dialog, setDialog] = useState({ open: false, kind: null, backup: null });

    async function loadBackups(page = 1) {
        setLoading(true);
        try {
            const payload = await listBackups({ page, per_page: 10 });
            setBackups(payload.data || []);
            setMeta(payload.meta || { current_page: 1, last_page: 1, total: 0 });
        } catch (error) {
            setNotice({ type: 'error', message: error.message });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadBackups(1);
    }, []);

    // A backup can take minutes, so warn before the tab is closed mid-run.
    useEffect(() => {
        if (!creating && restoringId === null) return undefined;

        function warn(event) {
            event.preventDefault();
            event.returnValue = '';
        }

        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [creating, restoringId]);

    function closeDialog() {
        setDialog((current) => ({ ...current, open: false }));
    }

    async function runBackup() {
        closeDialog();
        setCreating(true);
        setNotice({ type: 'info', message: 'Creating backup. This can take a few minutes on a large database — leave this page open.' });

        try {
            const payload = await createBackup();
            setNotice({
                type: 'success',
                message: `Backup ${payload.data?.filename || ''} created successfully.`.replace('  ', ' '),
            });
            await loadBackups(1);
        } catch (error) {
            setNotice({ type: 'error', message: error.message });
            // A failed attempt is recorded server-side, so refresh to show it.
            await loadBackups(1);
        } finally {
            setCreating(false);
        }
    }

    async function runRestore() {
        const backup = dialog.backup;

        closeDialog();
        setRestoringId(backup.backup_id);
        setNotice({ type: 'info', message: 'Restoring the database. This can take several minutes — leave this page open.' });

        try {
            await restoreBackup(backup.backup_id);

            // Every session is invalidated by a restore, this one included, so
            // there is nothing useful left to show on this page.
            setNotice({ type: '', message: '' });
            setDialog({ open: true, kind: 'restored', backup: null });
        } catch (error) {
            setNotice({ type: 'error', message: error.message });
            await loadBackups(meta.current_page || 1);
        } finally {
            setRestoringId(null);
        }
    }

    async function download(backup) {
        setDownloadingId(backup.backup_id);
        setNotice({ type: '', message: '' });

        try {
            await downloadBackup(backup.backup_id, backup.filename);
        } catch (error) {
            setNotice({ type: 'error', message: error.message });
        } finally {
            setDownloadingId(null);
        }
    }

    return React.createElement(React.Fragment, null,
        React.createElement(TechnicalAdminSidebar, { onNotice: (message) => setNotice({ type: 'info', message }) }),
        React.createElement('main', { className: 'app-shell-main backup-page' },
            React.createElement('div', { className: 'app-shell-container' },
                React.createElement(PageHeader, { section: 'Technical Administration', title: 'Manual Backup', subtitle: 'Create a copy of the system database and download it for safekeeping.' }),

                notice.message ? React.createElement('div', { className: `ui-status ui-status--${notice.type}`, role: 'status', 'aria-live': 'polite' }, notice.message) : null,

                React.createElement('section', { className: 'ui-card backup-run', 'aria-labelledby': 'backup-run-title' },
                    React.createElement('div', { className: 'ui-section-header' },
                        React.createElement('div', { className: 'ui-section-header__copy' },
                            React.createElement('h2', { id: 'backup-run-title' }, 'Create a manual backup'),
                            React.createElement('p', null, 'Capture a secure copy of the current system database.')
                        ),
                        React.createElement('i', { className: 'bi bi-database-down', 'aria-hidden': 'true' })
                    ),
                    React.createElement('div', { className: 'ui-card__body' },
                        React.createElement('p', { className: 'backup-run__copy' }, 'Captures the entire database, including every user account and strategic plan. The system stays usable while a backup runs.'),
                        React.createElement('div', { className: 'backup-run__actions' },
                            canCreate
                                ? React.createElement('button', {
                                    className: 'ui-button ui-button--primary',
                                    type: 'button',
                                    disabled: creating,
                                    onClick: () => setDialog({ open: true, kind: 'create', backup: null }),
                                },
                                    React.createElement('i', { className: `bi ${creating ? 'bi-hourglass-split' : 'bi-database-down'}`, 'aria-hidden': 'true' }),
                                    creating ? 'Creating backup…' : 'Create backup'
                                )
                                : React.createElement('p', { className: 'ui-help' }, 'You do not have permission to create backups.')
                        )
                    )
                ),

                React.createElement('section', { className: 'ui-card', 'aria-labelledby': 'backup-list-title' },
                    React.createElement('div', { className: 'ui-section-header' },
                        React.createElement('div', { className: 'ui-section-header__copy' },
                            React.createElement('h2', { id: 'backup-list-title' }, 'Backup Register'),
                            React.createElement('p', null, `${meta.total || 0} backup record${meta.total === 1 ? '' : 's'}`)
                        ),
                        React.createElement('i', { className: 'bi bi-shield-lock-fill', 'aria-hidden': 'true' })
                    ),
                    React.createElement('div', { className: 'ui-card__body' },
                        React.createElement('p', { className: 'backup-warning' },
                            React.createElement('i', { className: 'bi bi-shield-lock-fill', 'aria-hidden': 'true' }),
                            ' A backup file contains all system data, including user records. Store downloads securely — every download is recorded in the security log.'
                        ),

                        loading
                            ? React.createElement('p', { className: 'ui-help' }, 'Loading backups…')
                            : backups.length === 0
                                ? React.createElement('p', { className: 'ui-help' }, 'No backups have been created yet.')
                                : React.createElement('div', { className: 'ui-table-wrap' },
                                    React.createElement('table', { className: 'ui-table backup-table' },
                                        React.createElement('caption', { className: 'ui-visually-hidden' }, 'Previously created database backups'),
                                        React.createElement('thead', null,
                                            React.createElement('tr', null,
                                                React.createElement('th', { scope: 'col' }, 'Created'),
                                                React.createElement('th', { scope: 'col' }, 'Created by'),
                                                React.createElement('th', { scope: 'col' }, 'Size'),
                                                React.createElement('th', { scope: 'col' }, 'Status'),
                                                React.createElement('th', { scope: 'col' }, 'Action')
                                            )
                                        ),
                                        React.createElement('tbody', null,
                                            backups.map((backup) => React.createElement('tr', { key: backup.backup_id },
                                                React.createElement('td', null,
                                                    React.createElement('strong', null, formatTimestamp(backup.created_at)),
                                                    React.createElement('span', { className: 'backup-filename' }, backup.filename)
                                                ),
                                                React.createElement('td', null, backup.created_by?.name || 'Unknown'),
                                                React.createElement('td', null, backup.size_label || '—'),
                                                React.createElement('td', null,
                                                    React.createElement('span', { className: `ui-badge ui-badge--${backup.status === 'completed' ? 'success' : 'danger'}` }, backup.status === 'completed' ? 'Completed' : 'Failed'),
                                                    backup.status !== 'completed' && backup.error_message
                                                        ? React.createElement('span', { className: 'backup-error' }, backup.error_message)
                                                        : null
                                                ),
                                                React.createElement('td', null,
                                                    backup.downloadable && canDownload
                                                        ? React.createElement('button', {
                                                            className: 'ui-button ui-button--secondary ui-button--sm',
                                                            type: 'button',
                                                            disabled: downloadingId === backup.backup_id,
                                                            onClick: () => download(backup),
                                                        },
                                                            React.createElement('i', { className: 'bi bi-download', 'aria-hidden': 'true' }),
                                                            downloadingId === backup.backup_id ? 'Preparing…' : 'Download'
                                                        )
                                                        : React.createElement('span', { className: 'ui-help' }, backup.downloadable ? 'Not permitted' : 'Unavailable'),
                                                    backup.restorable && canRestore
                                                        ? React.createElement('button', {
                                                            className: 'ui-button ui-button--danger ui-button--sm backup-restore',
                                                            type: 'button',
                                                            disabled: restoringId !== null || creating,
                                                            onClick: () => setDialog({ open: true, kind: 'restore', backup }),
                                                        },
                                                            React.createElement('i', { className: 'bi bi-arrow-counterclockwise', 'aria-hidden': 'true' }),
                                                            restoringId === backup.backup_id ? 'Restoring…' : 'Restore'
                                                        )
                                                        : null
                                                )
                                            ))
                                        )
                                    )
                                ),

                        meta.last_page > 1 ? React.createElement('div', { className: 'ui-pagination' },
                            React.createElement('span', null, `Page ${meta.current_page} of ${meta.last_page} · ${meta.total} backups`),
                            React.createElement('div', { className: 'ui-pagination__actions' },
                                React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: loading || meta.current_page <= 1, onClick: () => loadBackups(meta.current_page - 1) }, React.createElement('i', { className: 'bi bi-chevron-left' }), 'Previous'),
                                React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', disabled: loading || meta.current_page >= meta.last_page, onClick: () => loadBackups(meta.current_page + 1) }, 'Next', React.createElement('i', { className: 'bi bi-chevron-right' }))
                            )
                        ) : null
                    )
                )
            )
        ),

        React.createElement(AppDialog, {
            open: dialog.open,
            variant: dialog.kind === 'restored' ? 'success' : 'danger',
            title: dialog.kind === 'create'
                ? 'Create backup'
                : dialog.kind === 'restore'
                    ? 'Restore this backup?'
                    : 'Database restored',
            message: dialog.kind === 'create'
                ? 'This copies the entire database, including every user account and password hash. It can take several minutes and the file will be downloadable by anyone with backup download permission. Continue?'
                : dialog.kind === 'restore'
                    ? `Replace all system data with ${dialog.backup?.filename || 'this backup'}, taken ${formatTimestamp(dialog.backup?.created_at)}. Everything recorded since then is lost and cannot be recovered. Every signed-in user is signed out, including you.`
                    : 'The database was replaced and all sessions were ended. Sign in again to continue.',
            confirmLabel: dialog.kind === 'create'
                ? 'Create backup'
                : dialog.kind === 'restore'
                    ? 'Restore database'
                    : 'Return to sign in',
            cancelLabel: 'Cancel',
            onConfirm: dialog.kind === 'create'
                ? runBackup
                : dialog.kind === 'restore'
                    ? runRestore
                    : () => logout(),
            onCancel: closeDialog,
        })
    );
}

mountProtectedPage(document.getElementById('root'), () => React.createElement(ManualBackupApp));
