export const MANAGEMENT_PAGE_SIZE = 10;

export function pageRows(rows, page, pageSize = MANAGEMENT_PAGE_SIZE) {
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    const current = Math.min(Math.max(1, page), pages);
    return rows.slice((current - 1) * pageSize, current * pageSize);
}

export function ManagementPagination({ page, total, onChange, pageSize = MANAGEMENT_PAGE_SIZE, label = 'records' }) {
    const h = React.createElement;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (pages <= 1) return null;
    const current = Math.min(Math.max(1, page), pages);
    const first = Math.max(1, Math.min(current - 2, pages - 4));
    const visible = Array.from({ length: Math.min(5, pages - first + 1) }, (_, index) => first + index);
    const button = (text, target, disabled = false, active = false) => h('button', {
        type: 'button', key: `${text}-${target}`, disabled, onClick: () => onChange(target),
        className: `management-pagination__button${active ? ' is-active' : ''}`,
        'aria-current': active ? 'page' : undefined,
        'aria-label': typeof text === 'number' ? `Page ${text}` : text,
    }, text);
    return h('nav', { className: 'management-pagination', 'aria-label': `${label} pages` },
        h('span', { className: 'management-pagination__summary' },
            `Showing ${(current - 1) * pageSize + 1}–${Math.min(current * pageSize, total)} of ${total} ${label}`),
        h('div', { className: 'management-pagination__buttons' },
            button('Previous', current - 1, current === 1),
            first > 1 ? button('1', 1) : null,
            first > 2 ? h('span', { key: 'start-gap', 'aria-hidden': true }, '…') : null,
            visible.map(number => button(number, number, false, number === current)),
            visible.at(-1) < pages - 1 ? h('span', { key: 'end-gap', 'aria-hidden': true }, '…') : null,
            visible.at(-1) < pages ? button(String(pages), pages) : null,
            button('Next', current + 1, current === pages)));
}
