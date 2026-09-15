import { getAccessSession } from '../access/access-session.js';

const h = React.createElement;
const DOCUMENTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
const VIDEOS = ['mp4', 'mov'];
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const sizeLabel = bytes => bytes === 0 ? '0 KB' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function OfficeReferenceMaterials({ plan, allowed, back }) {
    const [files, setFiles] = React.useState([]);
    const [category, setCategory] = React.useState('');
    const [level, setLevel] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [error, setError] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [dragging, setDragging] = React.useState('');
    const documentInput = React.useRef(null);
    const videoInput = React.useRef(null);
    const reader = React.useRef(null);
    const cancelled = React.useRef(false);
    const mounted = React.useRef(true);
    React.useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; cancelled.current = true; reader.current?.abort(); };
    }, []);
    const updateFile = (id, values) => {
        if (mounted.current) setFiles(current => current.map(item => item.id === id ? { ...item, ...values } : item));
    };
    function addFiles(selected, group) {
        if (!allowed || busy) return;
        const extensions = group === 'documents' ? DOCUMENTS : VIDEOS;
        const next = [...files];
        const errors = [];
        for (const file of Array.from(selected)) {
            const extension = file.name.split('.').pop().toLowerCase();
            if (!extensions.includes(extension)) { errors.push(`${file.name}: unsupported format.`); continue; }
            if (!file.size || file.size > MAX_FILE_BYTES) { errors.push(`${file.name}: choose a non-empty file up to 50 MB.`); continue; }
            if (next.some(item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified)) continue;
            if (next.length >= 10 || next.reduce((sum, item) => sum + item.file.size, 0) + file.size > MAX_TOTAL_BYTES) {
                errors.push('Select up to 10 files, with a combined size of 100 MB.'); break;
            }
            next.push({ id: crypto.randomUUID(), file, extension, group, progress: 0, status: 'ready' });
        }
        setFiles(next); setError(errors.join(' ')); setMessage('');
    }
    async function prepare(event) {
        event.preventDefault();
        if (!allowed || busy || !files.length || !category || !level) return;
        cancelled.current = false; setBusy(true); setError(''); setMessage('Preparing a local preview…');
        let failed = false;
        for (const item of files) {
            if (cancelled.current) break;
            updateFile(item.id, { progress: 0, status: 'reading' });
            try {
                await new Promise((resolve, reject) => {
                    const current = new FileReader(); reader.current = current;
                    current.onprogress = event => { if (event.lengthComputable) updateFile(item.id, { progress: Math.round(event.loaded / event.total * 100) }); };
                    current.onload = resolve;
                    current.onerror = () => reject(new Error('File could not be read.'));
                    current.onabort = () => reject(new Error('Preview cancelled.'));
                    current.readAsArrayBuffer(item.file);
                });
                updateFile(item.id, { progress: 100, status: 'prepared' });
            } catch {
                failed = true;
                updateFile(item.id, { progress: 0, status: cancelled.current ? 'ready' : 'error' });
            } finally { reader.current = null; }
        }
        if (!mounted.current) return;
        setBusy(false);
        setMessage(cancelled.current ? 'Preview cancelled. Your selected files are still available.' : failed ? 'Some files could not be read. Remove them or try again.' : 'File preview is ready. No files have been uploaded.');
    }
    function dropzone(group, title, icon, formats, ref) {
        return h('section', { className: 'office-upload-group', key: group },
            h('h3', null, h('span', { className: 'office-upload-icon' }, h('i', { className: `bi ${icon}`, 'aria-hidden': true })), title),
            h('input', { ref, className: 'office-file-input', type: 'file', tabIndex: -1, 'aria-label': `Choose ${title.toLowerCase()}`, accept: formats.map(format => '.' + format).join(','), multiple: true, disabled: !allowed || busy,
                onChange: event => { addFiles(event.target.files, group); event.target.value = ''; } }),
            h('button', {
                type: 'button', className: `office-dropzone${dragging === group ? ' is-dragging' : ''}`, disabled: !allowed || busy,
                onClick: () => ref.current?.click(), onDragOver: event => { event.preventDefault(); if (allowed && !busy) setDragging(group); },
                onDragLeave: () => setDragging(''), onDrop: event => { event.preventDefault(); setDragging(''); addFiles(event.dataTransfer.files, group); },
            }, h('i', { className: 'bi bi-cloud-arrow-up', 'aria-hidden': true }), h('strong', null, 'Click to select files'), h('span', null, 'or drag and drop them here')),
            h('p', { className: 'office-upload-support' }, `Supported formats: ${formats.join(', ').toUpperCase()} · Up to 50 MB per file`));
    }
    return h('form', { onSubmit: prepare, className: 'office-materials-form' },
        h('section', { className: 'office-panel office-reference-category', 'aria-labelledby': 'reference-category-title' },
            h('h2', { id: 'reference-category-title' }, 'Select reference category'),
            h('div', { className: 'office-reference-fields' },
                h('label', { className: 'office-field-group' }, 'Selected plan', h('input', { value: plan.title, readOnly: true, title: plan.title })),
                h('label', { className: 'office-field-group' }, 'Reference level', h('select', { required: true, value: level, disabled: !allowed || busy, onChange: event => { setLevel(event.target.value); setMessage(''); } }, h('option', { value: '' }, 'Select from list'), ['Agenda', 'PDP', 'DOST', 'Agency'].map(value => h('option', { key: value }, value)))),
                h('label', { className: 'office-field-group' }, 'Content category', h('select', { required: true, value: category, disabled: !allowed || busy, onChange: event => { setCategory(event.target.value); setMessage(''); } }, h('option', { value: '' }, 'Select from list'), ['Mission', 'Vision', 'Core Values', 'Strategic Objectives', 'Supporting Evidence'].map(value => h('option', { key: value }, value)))),
                h('label', { className: 'office-field-group' }, 'Office / Agency', h('input', { readOnly: true, value: getAccessSession()?.office || 'Not assigned' })))),
        !allowed && h('p', { className: 'office-scope' }, 'Reference materials are read-only for this plan or your account.'),
        error && h('p', { className: 'office-upload-error', role: 'alert' }, error),
        h('div', { className: 'office-materials-grid' },
            h('section', { className: 'office-panel office-upload-panel', 'aria-labelledby': 'upload-materials-title' },
                h('h2', { id: 'upload-materials-title' }, 'Upload reference materials here'),
                dropzone('documents', 'Documents', 'bi-file-earmark-text', DOCUMENTS, documentInput),
                dropzone('videos', 'Video', 'bi-camera-video', VIDEOS, videoInput)),
            h('aside', { className: 'office-selected-panel', 'aria-labelledby': 'selected-files-title' },
                h('div', { className: 'office-panel office-selected-heading' }, h('h2', { id: 'selected-files-title' }, 'Selected files'), h('span', null, files.length)),
                files.length ? h('ul', { className: 'office-selected-files' }, files.map(item => h('li', { className: 'office-panel office-selected-file', key: item.id },
                    h('i', { className: `bi ${item.group === 'videos' ? 'bi-file-earmark-play' : item.extension === 'pdf' ? 'bi-file-earmark-pdf' : ['xls', 'xlsx'].includes(item.extension) ? 'bi-file-earmark-excel' : 'bi-file-earmark-word'} office-file-icon is-${item.extension}`, 'aria-hidden': true }),
                    h('div', { className: 'office-file-copy' }, h('strong', { title: item.file.name }, item.file.name),
                        h('span', null, `${item.status === 'prepared' ? 'Preview ready' : item.status === 'reading' ? 'Preparing preview' : item.status === 'error' ? 'Unable to read' : 'Selected'} · ${sizeLabel(item.file.size)}`),
                        ['reading', 'prepared'].includes(item.status) && h('progress', { max: 100, value: item.progress, 'aria-label': `Local preview progress for ${item.file.name}` })),
                    h('button', { type: 'button', className: 'office-file-remove', disabled: busy, 'aria-label': `Remove ${item.file.name}`, onClick: () => { setFiles(current => current.filter(file => file.id !== item.id)); setMessage(''); } }, h('i', { className: 'bi bi-x', 'aria-hidden': true })))))
                    : h('div', { className: 'office-panel office-files-empty' }, h('i', { className: 'bi bi-files', 'aria-hidden': true }), h('p', null, 'No files selected'), h('span', null, 'Your documents and videos will appear here.')),
                h('div', { className: 'office-upload-note' }, h('i', { className: 'bi bi-info-circle', 'aria-hidden': true }), h('p', null, 'Attachment preview only. Selected files stay on this device and are not attached to your submitted planning input.')))),
        h('p', { className: 'office-upload-status', role: 'status', 'aria-live': 'polite' }, message),
        h('footer', { className: 'office-materials-actions' },
            h('span', null, `${files.length} files · ${sizeLabel(files.reduce((sum, item) => sum + item.file.size, 0))} total`),
            busy ? h('button', { type: 'button', className: 'ui-button ui-button--secondary', onClick: () => { cancelled.current = true; reader.current?.abort(); } }, 'Cancel Preview') : h('a', { href: back, className: 'ui-button ui-button--secondary' }, 'Cancel'),
            h('button', { type: 'submit', className: 'ui-button ui-button--primary office-materials-submit', disabled: !allowed || busy || !files.length || !category || !level }, h('i', { className: 'bi bi-cloud-arrow-up', 'aria-hidden': true }), busy ? 'Preparing…' : 'Preview Selected Files')));
}

