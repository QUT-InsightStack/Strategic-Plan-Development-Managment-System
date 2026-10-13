// Dispose page effects before navigating and ignore late responses from the old page.
const roots = new Set();
export function createPageRoot(element) {
    const root = ReactDOM.createRoot(element);
    let active = true;
    const page = {
        render(content) { if (active) root.render(content); },
        unmount() { if (active) { active = false; roots.delete(page); root.unmount(); } },
    };
    roots.add(page);
    return page;
}
export function unmountPages() {
    for (const root of [...roots]) root.unmount();
}
