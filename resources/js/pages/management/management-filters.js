import { planningPeriods } from './management-insights.js';

// Shared Management filters live in the URL so they survive tab changes and moves between
// /management-dashboard, /management-approvals and /management-plan-review. The last set is
// also kept for this browser tab so sidebar links, which carry no query, reopen with it.
export const EMPTY_MANAGEMENT_FILTERS = Object.freeze({ planId: '', period: '', office: '', status: '', approvalStatus: '' });
const PARAMS = { planId: 'filter_plan', period: 'period', office: 'office', status: 'filter_status', approvalStatus: 'approval' };
const STORAGE_KEY = 'spdms.management-filters';

export const APPROVAL_OPTIONS = [['not_submitted', 'Not submitted'], ['under_approval', 'Awaiting approval'], ['approved', 'Approved'], ['rejected', 'Returned for correction']];
export const OBJECTIVE_STATUS_OPTIONS = [['not_started', 'Not Started'], ['in_progress', 'Ongoing'], ['completed', 'Completed'], ['overdue', 'Overdue / Delayed']];

export function readManagementFilters(search) {
    const params = new URLSearchParams(search);
    return Object.fromEntries(Object.entries(PARAMS).map(([key, param]) => [key, params.get(param) || '']));
}

export function hasManagementFilters(filters) {
    return Object.keys(EMPTY_MANAGEMENT_FILTERS).some(key => Boolean(filters?.[key]));
}

export function writeManagementFilters(params, filters) {
    Object.entries(PARAMS).forEach(([key, param]) => {
        if (filters[key]) params.set(param, filters[key]);
        else params.delete(param);
    });
    return params;
}

function storedFilters() {
    try {
        const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
        return value && typeof value === 'object' ? { ...EMPTY_MANAGEMENT_FILTERS, ...readManagementFilters(writeManagementFilters(new URLSearchParams(), value)) } : null;
    } catch {
        return null;
    }
}

function storeFilters(filters) {
    try {
        if (hasManagementFilters(filters)) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
        else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // Storage can be unavailable; the URL still carries the filters.
    }
}

function replaceUrlFilters(filters) {
    const url = new URL(window.location.href);
    writeManagementFilters(url.searchParams, filters);
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
}

// pageQuery is the page's current URLSearchParams (from usePageQuery or window.location.search).
export function useManagementFilters(pageQuery) {
    const [filters, setFilters] = React.useState(() => {
        const fromUrl = readManagementFilters(pageQuery);
        return hasManagementFilters(fromUrl) ? fromUrl : storedFilters() || { ...EMPTY_MANAGEMENT_FILTERS };
    });
    React.useEffect(() => {
        // A sidebar link without filter parameters keeps the current filters.
        const fromUrl = readManagementFilters(pageQuery);
        if (hasManagementFilters(fromUrl)) setFilters(fromUrl);
    }, [String(pageQuery)]);
    React.useEffect(() => {
        replaceUrlFilters(filters);
        storeFilters(filters);
    }, [filters, String(pageQuery)]);
    const setFilter = (key, value) => setFilters(previous => ({ ...previous, [key]: value }));
    const resetFilters = () => setFilters({ ...EMPTY_MANAGEMENT_FILTERS });
    return { filters, setFilter, resetFilters };
}

const h = (...args) => React.createElement(...args);

function select(key, label, value, options, onChange, placeholder, disabled) {
    return h('label', { key }, h('span', null, label),
        h('select', { value, disabled, onChange: event => onChange(key, event.target.value) },
            h('option', { value: '' }, placeholder),
            options.map(option => option.group
                ? h('optgroup', { key: option.group, label: option.group }, option.options.map(([optionValue, text]) => h('option', { key: optionValue, value: optionValue }, text)))
                : h('option', { key: option[0], value: option[0] }, option[1]))));
}

export function PlanningPeriodSelect({ filters, plans, onChange, disabled = false }) {
    return select('period', 'Planning period', filters.period, planningPeriods(plans).map(period => [period.value, period.label]), onChange, 'All periods', disabled);
}

// Options come only from the records the API returned for this account.
export function ManagementFilterBar({ filters, plans, offices = [], onChange, onReset, includePeriod = true, includeObjectiveStatus = true, disabled = false }) {
    const planStatuses = [...new Set(plans.map(plan => plan.status).filter(Boolean))].sort();
    const statusGroups = [
        { group: 'Plan status', options: planStatuses.map(status => [`plan:${status}`, plans.find(plan => plan.status === status && plan.planning_status_label)?.planning_status_label
            || (status === 'finished' ? 'Finalized' : status.charAt(0).toUpperCase() + status.slice(1).replaceAll('_', ' '))]) },
        ...(includeObjectiveStatus ? [{ group: 'Objective status', options: OBJECTIVE_STATUS_OPTIONS.map(([value, label]) => [`objective:${value}`, label]) }] : []),
    ].filter(group => group.options.length);
    // An objective status chosen on the dashboard stays in the URL but does not apply to plan-only lists.
    if (filters.status && !statusGroups.some(group => group.options.some(([value]) => value === filters.status))) {
        statusGroups.push({ group: 'Not applied on this page', options: [[filters.status, filters.status.split(':').pop().replaceAll('_', ' ')]] });
    }
    const sortedPlans = [...plans].sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    const approvals = APPROVAL_OPTIONS.filter(([value]) => plans.some(plan => (plan.approval_status || 'not_submitted') === value) || filters.approvalStatus === value);
    return h('section', { className: 'management-scope-filters', 'aria-label': 'Dashboard filters' },
        select('planId', 'Strategic Plan', filters.planId, sortedPlans.map(plan => [String(plan.record_id), plan.title || `Plan ${plan.record_id}`]), onChange, 'All plans', disabled),
        includePeriod ? h(PlanningPeriodSelect, { filters, plans, onChange, disabled }) : null,
        select('office', 'Office / Unit', filters.office, offices.map(name => [name, name]), onChange, 'All offices / units', disabled),
        select('status', includeObjectiveStatus ? 'Plan / Objective status' : 'Plan status', filters.status, statusGroups, onChange, 'All statuses', disabled),
        select('approvalStatus', 'Approval status', filters.approvalStatus, approvals, onChange, 'All approval statuses', disabled),
        h('button', { className: 'ui-button ui-button--secondary ui-button--sm management-scope-filters__reset', type: 'button', onClick: onReset, disabled: !hasManagementFilters(filters) },
            h('i', { className: 'bi bi-arrow-counterclockwise', 'aria-hidden': true }), ' Reset filters'));
}
