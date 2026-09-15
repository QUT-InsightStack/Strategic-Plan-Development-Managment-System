import { enforcePageAccess } from '../access/access-guard.js';
import { AppSidebar } from '../components/AppSidebar.js';
import { AdministrativeAdminSidebar } from '../components/AdministrativeAdminSidebar.js';
import { PageHeader } from '../components/PageHeader.js';
import { AppDialog } from '../components/AppDialog.js';
import { archivePdpChapter, createPdpChapter, deletePdpChapter, getPdpChapter, listPdpChapters, updatePdpChapter } from '../api/pdp-chapters-api.js';

enforcePageAccess();
const { useEffect, useMemo, useState } = React;
const rootElement = document.getElementById('root');
const isManageMode = rootElement.dataset.mode === 'manage';
const isDetailMode = rootElement.dataset.mode === 'detail';
const chapterId = Number(rootElement.dataset.chapterId);
const fromManagement = new URLSearchParams(window.location.search).get('from') === 'manage';
const emptyForm = { chapter_title: '', chapter_description: '' };
const storageKey = 'spdms.selected-pdp-chapters';

function initialSelection() {
    try { const ids = JSON.parse(sessionStorage.getItem(storageKey)); return Array.isArray(ids) ? ids.map(Number) : []; }
    catch { return []; }
}

function formatDate(value) {
    return value ? new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function ChapterDialog({ mode, chapter, onClose, onSaved }) {
    const editable = mode !== 'view';
    const [form, setForm] = useState(emptyForm);
    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm(chapter ? { chapter_title: chapter.chapter_title, chapter_description: chapter.chapter_description } : emptyForm);
        setErrors({});
        setSubmitError('');
    }, [chapter, mode]);

    async function save(event) {
        event.preventDefault(); setSaving(true); setErrors({}); setSubmitError('');
        try {
            const payload = mode === 'edit' ? await updatePdpChapter(chapter.chapter_id, form) : await createPdpChapter(form);
            await onSaved(payload);
        } catch (error) { setErrors(error.errors || {}); setSubmitError(error.message || 'The chapter could not be saved.'); }
        finally { setSaving(false); }
    }

    return React.createElement('div', { className: 'pdp-dialog-backdrop', onMouseDown: (event) => { if (event.target === event.currentTarget) onClose(); } },
        React.createElement('section', { className: 'ui-card pdp-dialog', role: 'dialog', 'aria-modal': 'true' },
            React.createElement('header', { className: 'pdp-dialog__header' },
                React.createElement('div', null, React.createElement('h2', null, mode === 'create' ? 'Create New Chapter' : mode === 'edit' ? 'Edit PDP Chapter' : 'PDP Chapter Details'), React.createElement('p', null, editable ? 'Maintain the chapter title and description.' : 'Review the complete chapter information.')),
                React.createElement('button', { className: 'pdp-dialog__close', type: 'button', onClick: onClose, 'aria-label': 'Close' }, React.createElement('i', { className: 'bi bi-x-lg' }))),
            editable ? React.createElement('form', { className: 'pdp-dialog__body', onSubmit: save },
                React.createElement('div', { className: `ui-field${errors.chapter_title ? ' is-invalid' : ''}` }, React.createElement('label', { className: 'ui-label', htmlFor: 'chapter-title' }, 'Chapter title *'), React.createElement('input', { id: 'chapter-title', className: 'ui-input', value: form.chapter_title, maxLength: 255, onChange: (event) => setForm({ ...form, chapter_title: event.target.value }) }), errors.chapter_title ? React.createElement('p', { className: 'ui-error' }, errors.chapter_title[0]) : null),
                React.createElement('div', { className: `ui-field${errors.chapter_description ? ' is-invalid' : ''}` }, React.createElement('label', { className: 'ui-label', htmlFor: 'chapter-description' }, 'Chapter description *'), React.createElement('textarea', { id: 'chapter-description', className: 'ui-textarea', rows: 10, value: form.chapter_description, onChange: (event) => setForm({ ...form, chapter_description: event.target.value }) }), errors.chapter_description ? React.createElement('p', { className: 'ui-error' }, errors.chapter_description[0]) : null),
                submitError ? React.createElement('div', { className: 'ui-status ui-status--error', role: 'alert' }, submitError) : null,
                React.createElement('footer', { className: 'pdp-dialog__actions' }, React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: onClose }, 'Cancel'), React.createElement('button', { className: 'ui-button ui-button--primary', type: 'submit', disabled: saving }, saving ? 'Saving…' : 'Save Chapter')))
                : React.createElement('div', { className: 'pdp-dialog__body pdp-details' },
                    React.createElement('div', null, React.createElement('span', null, 'Chapter title'), React.createElement('strong', null, chapter.chapter_title)),
                    React.createElement('div', null, React.createElement('span', null, 'Chapter description'), React.createElement('p', null, chapter.chapter_description)),
                    React.createElement('div', { className: 'pdp-details__dates' }, React.createElement('div', null, React.createElement('span', null, 'Created at'), React.createElement('strong', null, formatDate(chapter.created_at))), React.createElement('div', null, React.createElement('span', null, 'Updated at'), React.createElement('strong', null, formatDate(chapter.updated_at)))))
        ));
}

function ChapterTable({ chapters, loading, selectedIds, onToggle, onOpen, onArchive, onDelete }) {
    const columns = 5;
    return React.createElement('section', { className: 'ui-card pdp-table-card', 'aria-labelledby': 'pdp-register-title' },
        React.createElement('div', { className: 'ui-section-header' },
            React.createElement('div', { className: 'ui-section-header__copy' },
                React.createElement('h2', { id: 'pdp-register-title' }, 'PDP Chapter Register'),
                React.createElement('p', null, loading ? 'Loading the latest chapter records…' : `${chapters.length} chapter record${chapters.length === 1 ? '' : 's'} shown`)
            ),
            React.createElement('i', { className: 'bi bi-journal-text', 'aria-hidden': 'true' })
        ),
        React.createElement('div', { className: 'pdp-table-scroll' },
            React.createElement('table', { className: 'pdp-table' },
                React.createElement('thead', null,
                    React.createElement('tr', null,
                        !isManageMode ? React.createElement('th', null, 'Select') : null,
                        React.createElement('th', null, 'Chapter title'),
                        React.createElement('th', null, 'Description'),
                        React.createElement('th', null, 'Created at'),
                        React.createElement('th', null, 'Updated at'),
                        isManageMode ? React.createElement('th', null, 'Action') : null)),
                React.createElement('tbody', null,
                    !loading && !chapters.length
                        ? React.createElement('tr', null, React.createElement('td', { className: 'pdp-table__empty', colSpan: columns }, 'No PDP Chapters match the current search and filter.'))
                        : chapters.map((chapter) => React.createElement('tr', { key: chapter.chapter_id },
                            !isManageMode ? React.createElement('td', { className: 'pdp-table__select' }, React.createElement('input', { type: 'checkbox', checked: selectedIds.includes(chapter.chapter_id), onChange: () => onToggle(chapter.chapter_id), 'aria-label': `Select ${chapter.chapter_title}` })) : null,
                            React.createElement('td', { className: 'pdp-table__title' }, React.createElement('a', { href: `/pdp-chapters/${chapter.chapter_id}${isManageMode ? '?from=manage' : ''}` }, chapter.chapter_title)),
                            React.createElement('td', { className: 'pdp-table__description' }, chapter.chapter_description),
                            React.createElement('td', null, formatDate(chapter.created_at)),
                            React.createElement('td', null, formatDate(chapter.updated_at)),
                            isManageMode ? React.createElement('td', null,
                                React.createElement('div', { className: 'pdp-table__actions' },
                                    React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => onOpen(chapter) }, 'Edit'),
                                    React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => onArchive(chapter) }, 'Archive'),
                                    React.createElement('button', { className: 'ui-button ui-button--danger ui-button--sm', type: 'button', onClick: () => onDelete(chapter) }, 'Delete'))) : null))))));
}

function PdpChapterDetailApp() {
    const [chapter, setChapter] = useState(null);
    const [error, setError] = useState('');
    const Sidebar = fromManagement ? AdministrativeAdminSidebar : AppSidebar;

    useEffect(() => {
        getPdpChapter(chapterId)
            .then((payload) => setChapter(payload.data))
            .catch((requestError) => setError(requestError.message));
    }, []);

    return React.createElement(React.Fragment, null,
        React.createElement(Sidebar, fromManagement ? { active: 'PDP Chapters' } : null),
        React.createElement('main', { className: 'app-shell-main pdp-page' },
            React.createElement('div', { className: 'app-shell-container pdp-detail-container' },
                React.createElement(PageHeader, {
                    className: 'pdp-header',
                    section: fromManagement ? 'Administrative Administration' : 'Strategic Planning',
                    title: 'PDP Chapter Details',
                    subtitle: 'Review the complete chapter content.',
                    actions: React.createElement('a', { className: 'ui-button ui-button--secondary', href: fromManagement ? '/pdp-chapters/manage' : '/pdp-chapters' }, 'Back to Chapter List'),
                }),
                error ? React.createElement('div', { className: 'ui-status ui-status--error' }, error) : null,
                !chapter ? React.createElement('div', { className: 'ui-card pdp-detail-card' }, 'Loading chapter…')
                    : React.createElement('article', { className: 'ui-card pdp-detail-card' },
                        React.createElement('div', { className: 'pdp-detail-field' }, React.createElement('span', null, 'Chapter title'), React.createElement('h2', null, chapter.chapter_title)),
                        React.createElement('div', { className: 'pdp-detail-field' }, React.createElement('span', null, 'Created time'), React.createElement('strong', null, formatDate(chapter.created_at))),
                        React.createElement('div', { className: 'pdp-detail-field' }, React.createElement('span', null, 'Updated time'), React.createElement('strong', null, formatDate(chapter.updated_at))),
                        React.createElement('div', { className: 'pdp-detail-field pdp-detail-description' }, React.createElement('span', null, 'Description'), React.createElement('div', null, chapter.chapter_description))))));
}

function PdpChaptersApp() {
    const [chapters, setChapters] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState(initialSelection), [dialog, setDialog] = useState(null);
    const [status, setStatus] = useState({ type: '', message: '' }), [loading, setLoading] = useState(true);
    const [confirmDialog, setConfirmDialog] = useState({ open: false, variant: 'danger', title: '', message: '', chapter: null, action: null });

    async function load() {
        setLoading(true);
        try {
            const chapterPayload = await listPdpChapters();
            setChapters(chapterPayload.data || []);
        } catch (error) { setStatus({ type: 'error', message: error.message }); }
        finally { setLoading(false); }
    }

    useEffect(() => { load(); }, []);
    useEffect(() => { if (!isManageMode) sessionStorage.setItem(storageKey, JSON.stringify(selectedIds)); }, [selectedIds]);

    function closeConfirmDialog() {
        setConfirmDialog((current) => ({ ...current, open: false }));
    }

    function requestDelete(chapter) {
        setConfirmDialog({
            open: true,
            variant: 'danger',
            title: 'Delete PDP Chapter?',
            message: `Delete “${chapter.chapter_title || 'Untitled chapter'}”? This action cannot be undone.`,
            chapter,
            action: 'delete',
        });
    }

    function requestArchive(chapter) {
        setConfirmDialog({
            open: true,
            variant: 'danger',
            title: 'Archive PDP Chapter?',
            message: `Archive \u201C${chapter.chapter_title || 'Untitled chapter'}\u201D? It will no longer appear as an active chapter, and the record and its history are kept.`,
            chapter,
            action: 'archive',
        });
    }

    async function confirmArchive() {
        const chapter = confirmDialog.chapter;

        closeConfirmDialog();
        setStatus({ type: '', message: '' });

        try {
            const payload = await archivePdpChapter(chapter.chapter_id);
            await load();
            setStatus({ type: 'success', message: payload.message || 'PDP Chapter archived successfully.' });
        } catch (error) {
            setConfirmDialog({
                open: true,
                variant: 'error',
                title: 'Archive failed',
                message: error.message || 'The chapter could not be archived.',
                chapter: null,
                action: null,
            });
        }
    }

    async function confirmDelete() {
        const chapter = confirmDialog.chapter;

        closeConfirmDialog();
        setStatus({ type: '', message: '' });

        try {
            const payload = await deletePdpChapter(chapter.chapter_id);
            await load();
            setStatus({ type: 'success', message: payload.message || 'PDP Chapter deleted successfully.' });
        } catch (error) {
            setConfirmDialog({
                open: true,
                variant: 'error',
                title: 'Delete failed',
                message: error.message || 'The chapter could not be deleted.',
                chapter: null,
                action: null,
            });
        }
    }

    const visible = useMemo(() => {
        const term = search.trim().toLowerCase();

        return chapters
            .filter((chapter) => chapter.status !== 'archived' && chapter.status !== 'deleted')
            .filter((chapter) => !term || [chapter.chapter_title, chapter.chapter_description].some((value) => String(value || '').toLowerCase().includes(term)));
    }, [chapters, search]);
    const Sidebar = isManageMode ? AdministrativeAdminSidebar : AppSidebar;

    return React.createElement(React.Fragment, null,
        React.createElement(Sidebar, { active: isManageMode ? 'PDP Chapters' : undefined, onNotice: (message) => setStatus({ type: 'info', message }) }),
        React.createElement('main', { className: 'app-shell-main pdp-page' }, React.createElement('div', { className: 'app-shell-container pdp-container' },
            React.createElement(PageHeader, {
                className: 'pdp-header',
                section: isManageMode ? 'Administrative Administration' : 'Strategic Planning',
                title: isManageMode ? 'Manage PDP Chapters' : 'PDP Chapter List',
                subtitle: isManageMode ? 'Create and maintain PDP Chapters.' : 'Review and select available PDP Chapters.',
                actions: isManageMode ? React.createElement('button', { className: 'ui-button ui-button--primary', type: 'button', onClick: () => setDialog({ mode: 'create', chapter: null }) }, React.createElement('i', { className: 'bi bi-plus-lg' }), ' Create New Chapter') : null,
            }),
            status.message ? React.createElement('div', { className: `ui-status ui-status--${status.type} pdp-status` }, status.message) : null,
            React.createElement('section', { className: 'ui-card pdp-filter-card', 'aria-label': 'Search PDP Chapters' },
                React.createElement('div', { className: 'pdp-toolbar' }, React.createElement('div', { className: 'ui-field' }, React.createElement('label', { className: 'ui-label', htmlFor: 'pdp-search' }, 'Search PDP Chapters'), React.createElement('input', { id: 'pdp-search', className: 'ui-input', value: search, placeholder: 'Search title or description', onChange: (event) => setSearch(event.target.value) })), React.createElement('button', { className: 'ui-button ui-button--secondary ui-button--sm', type: 'button', onClick: () => setSearch('') }, 'Clear'))
            ),
            React.createElement('p', { className: 'pdp-summary' }, loading ? 'Loading PDP Chapters…' : `${visible.length} chapter(s)${!isManageMode ? ` · ${selectedIds.length} selected` : ''}`),
            React.createElement(ChapterTable, { chapters: visible, loading, selectedIds, onToggle: (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]), onOpen: (chapter) => setDialog({ mode: isManageMode ? 'edit' : 'view', chapter }), onArchive: requestArchive, onDelete: requestDelete }),
            dialog ? React.createElement(ChapterDialog, { ...dialog, onClose: () => setDialog(null), onSaved: async (payload) => { setDialog(null); setStatus({ type: 'success', message: payload.message }); await load(); } }) : null,
            React.createElement(AppDialog, {
                open: confirmDialog.open,
                variant: confirmDialog.variant,
                title: confirmDialog.title,
                message: confirmDialog.message,
                confirmLabel: confirmDialog.action === 'delete' ? 'Confirm Delete' : confirmDialog.action === 'archive' ? 'Confirm Archive' : 'Close',
                onConfirm: confirmDialog.action === 'delete' ? confirmDelete : confirmDialog.action === 'archive' ? confirmArchive : closeConfirmDialog,
                onCancel: closeConfirmDialog,
            })
        ))
    );
}

ReactDOM.createRoot(rootElement).render(React.createElement(isDetailMode ? PdpChapterDetailApp : PdpChaptersApp));
