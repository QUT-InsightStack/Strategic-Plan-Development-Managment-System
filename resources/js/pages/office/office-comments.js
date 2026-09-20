import { listOfficeUpdates, saveOfficeUpdate } from '../../api/office-api.js';
import { can, getAccessSession } from '../../access/access-session.js';
const h = React.createElement;
export function OfficeComments({ plan }) {
 const [items, setItems] = React.useState([]), [notes, setNotes] = React.useState(''), [busy, setBusy] = React.useState(false), [message, setMessage] = React.useState(''), [page, setPage] = React.useState(1), [last, setLast] = React.useState(1), [refresh, setRefresh] = React.useState(0);
 React.useEffect(() => { let active = true; listOfficeUpdates(plan.record_id, page).then(result => { if (active) { setItems(result.data.data); setLast(result.data.last_page); } }).catch(error => { if (active) setMessage(error.message); }); return () => { active = false; }; }, [plan.record_id, page, refresh]);
 const allowed = plan.status === 'draft' && can('strategic_objectives.update');
 async function submit(event) { event.preventDefault(); if (busy || !allowed) return; setBusy(true); setMessage(''); try { await saveOfficeUpdate(plan, { kind: 'comment', content: notes }, getAccessSession()); setNotes(''); setMessage('Comment submitted.'); setPage(1); setRefresh(refresh + 1); } catch (error) { setMessage(error.message); } finally { setBusy(false); } }
 return h('section', { className: 'office-detail-notes', id: 'office-comments' }, h('h2', null, 'Notes/Comment'),
  h('div', { role: 'status', 'aria-live': 'polite' }, message),
  items.map(item => h('article', { className: 'office-update', key: item.id }, h('strong', null, [item.creator?.first_name, item.creator?.last_name].filter(Boolean).join(' ')), h('small', null, ' · ' + new Date(item.created_at).toLocaleString()), h('p', null, item.content), item.kind === 'progress' && h('p', null, `${item.progress_status}: ${item.progress}%`))),
  last > 1 && h('div', { className: 'office-pagination' }, h('button', { disabled: page <= 1, onClick: () => setPage(page - 1) }, 'Previous'), h('span', null, `${page} / ${last}`), h('button', { disabled: page >= last, onClick: () => setPage(page + 1) }, 'Next')),
  allowed ? h('form', { onSubmit: submit }, h('label', { htmlFor: 'office-comment' }, 'Your comment'), h('textarea', { id: 'office-comment', required: true, maxLength: 5000, value: notes, onChange: e => setNotes(e.target.value), disabled: busy, rows: 4 }), h('div', { className: 'office-detail-actions' }, h('button', { type: 'button', onClick: () => setNotes(''), disabled: busy }, 'Clear'), h('button', { type: 'submit', disabled: busy || !notes.trim() }, busy ? 'Submitting…' : 'Submit')))
   : h('p', { className: 'office-muted' }, 'Comments are read-only for this plan or your account.'));
}

