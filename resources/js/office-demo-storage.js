const INPUTS_KEY = 'spdms.frontend-agency-inputs';
const UPDATES_KEY = 'spdms.frontend-office-updates';
const FINALIZED_KEY = 'spdms.frontend-finalized-plans';

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

function planSnapshot(plan) {
    return { record_id: Number(plan.record_id), title: plan.title || `Plan ${plan.record_id}`, status: plan.status || 'draft' };
}

export function listLocalAgencyInputs(filters = {}) {
    const all = read(INPUTS_KEY, []);
    const office = String(filters.office || '').trim();
    const status = String(filters.status || '').trim();
    const planId = filters.plan_id;
    const userId = filters.created_by;
    const filtered = all.filter(item => (!office || item.office === office)
        && (!status || item.status === status)
        && (!planId || Number(item.plan_id) === Number(planId))
        && (!userId || Number(item.created_by) === Number(userId)));
    const page = Math.max(1, Number(filters.page) || 1);
    const perPage = Math.max(1, Number(filters.per_page) || 25);
    const start = (page - 1) * perPage;
    const statuses = ['pending', 'accepted', 'returned', 'rejected', 'merged'];
    const summary = Object.fromEntries(statuses.map(value => [value, all.filter(item => item.status === value).length]));
    return {
        data: filtered.slice(start, start + perPage),
        meta: {
            current_page: page,
            last_page: Math.max(1, Math.ceil(filtered.length / perPage)),
            per_page: perPage,
            total: filtered.length,
            offices: [...new Set(all.map(item => item.office).filter(Boolean))].sort(),
            summary,
            recent: [...all].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 5),
        },
    };
}

export function saveLocalAgencyInput(plan, data, session = {}) {
    const items = read(INPUTS_KEY, []);
    const now = new Date().toISOString();
    const input = {
        id: nextId(items),
        plan_id: Number(plan.record_id),
        plan: planSnapshot(plan),
        created_by: session.userId,
        creator: creator(session),
        office: session.office || 'Office / Agency',
        type: data.type || 'objective',
        payload: Object.fromEntries(Object.entries(data).filter(([key]) => !['type', 'version', 'source_objective_id'].includes(key))),
        source_objective_id: data.source_objective_id || null,
        status: 'pending', version: 1, review_note: '', result_id: null, history: [],
        created_at: now, updated_at: now,
    };
    items.unshift(input); write(INPUTS_KEY, items); return input;
}

export function reviewLocalAgencyInput(id, decision) {
    const items = read(INPUTS_KEY, []);
    const index = items.findIndex(item => Number(item.id) === Number(id));
    if (index < 0) throw new Error('Agency input was not found in this browser.');
    const current = items[index];
    const now = new Date().toISOString();
    const payload = Object.fromEntries(Object.entries(decision).filter(([key]) => !['action', 'note', 'target_id', 'version'].includes(key)));
    items[index] = {
        ...current,
        payload: Object.keys(payload).length ? payload : current.payload,
        status: decision.action,
        review_note: decision.note || '',
        result_id: decision.target_id || (['accepted', 'merged'].includes(decision.action) ? `preview-${current.id}` : null),
        version: Number(current.version || 1) + 1,
        updated_at: now,
        history: [...(current.history || []), { action: decision.action, note: decision.note || '', at: now, refined_payload: payload }],
    };
    write(INPUTS_KEY, items); return items[index];
}

export function resubmitLocalAgencyInput(id, data) {
    const items = read(INPUTS_KEY, []);
    const index = items.findIndex(item => Number(item.id) === Number(id));
    if (index < 0) throw new Error('Agency input was not found in this browser.');
    const now = new Date().toISOString();
    items[index] = { ...items[index], payload: Object.fromEntries(Object.entries(data).filter(([key]) => !['type', 'version'].includes(key))), status: 'pending', review_note: '', version: Number(items[index].version || 1) + 1, updated_at: now };
    write(INPUTS_KEY, items); return items[index];
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

export function getLocalFinalization(planId) {
    return read(FINALIZED_KEY, {})[String(planId)] || null;
}

export function saveLocalFinalization(plan) {
    const all = read(FINALIZED_KEY, {});
    const value = { status: 'finished', submitted_at: new Date().toISOString() };
    all[String(plan.record_id)] = value; write(FINALIZED_KEY, all); return { ...plan, ...value };
}
