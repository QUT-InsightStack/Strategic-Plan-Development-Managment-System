// Compatibility-only browser demo. Not used by the live plan comment form.
import { saveLocalAgencyInput } from './office-demo-storage.js';
const UPDATES_KEY = 'spdms.frontend-office-updates';
function read(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value ?? fallback;
    } catch { return fallback; }
}

function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function nextId(items) {
    return items.reduce((highest, item) => Math.max(highest, Number(item.id) || 0), 0) + 1;
}

function creator(session = {}) {
    const parts = String(session.name || '').trim().split(/\s+/);
    return { user_id: session.userId, first_name: parts.shift() || '', last_name: parts.join(' ') };
}

export function listLocalOfficeUpdates(planId, page = 1) {
    const all = read(UPDATES_KEY, []).filter(item => Number(item.plan_id) === Number(planId));
    const perPage = 10;
    const currentPage = Math.max(1, Number(page) || 1);
    return { data: { data: all.slice((currentPage - 1) * perPage, currentPage * perPage), current_page: currentPage, last_page: Math.max(1, Math.ceil(all.length / perPage)), total: all.length } };
}

export function saveLocalOfficeUpdate(plan, data, session = {}) {
    const items = read(UPDATES_KEY, []);
    const now = new Date().toISOString();
    const update = { id: nextId(items), plan_id: Number(plan.record_id), created_by: session.userId, creator: creator(session), ...data, created_at: now, updated_at: now };
    items.unshift(update); write(UPDATES_KEY, items);
    if (data.kind === 'comment') saveLocalAgencyInput(plan, { type: 'comment', content: data.content }, session);
    return { data: update };
}

