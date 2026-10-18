// Adjustable sidebar width. The layout reads --sidebar-width, so changing the variable resizes the
// sidebar and shifts every page's content. 260px is the default, in line with common government-site side navigation.
export const SIDEBAR_WIDTH = Object.freeze({ min: 200, max: 360, default: 260, step: 16 });
const STORAGE_KEY = 'spdms.sidebar-width';

export function clampSidebarWidth(value) {
    const number = Math.round(Number(value));
    if (!Number.isFinite(number)) return SIDEBAR_WIDTH.default;
    return Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, number));
}

export function storedSidebarWidth() {
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        return value === null ? SIDEBAR_WIDTH.default : clampSidebarWidth(value);
    } catch {
        return SIDEBAR_WIDTH.default;
    }
}

export function applySidebarWidth(width, { save = false } = {}) {
    const value = clampSidebarWidth(width);
    document.documentElement.style.setProperty('--sidebar-width', `${value}px`);
    if (save) {
        try {
            if (value === SIDEBAR_WIDTH.default) window.localStorage.removeItem(STORAGE_KEY);
            else window.localStorage.setItem(STORAGE_KEY, String(value));
        } catch {
            // Storage can be unavailable; the width still applies to this page.
        }
    }
    return value;
}

// Keyboard steps for the resize handle; returns the new width or null for other keys.
export function sidebarWidthForKey(key, width) {
    if (key === 'ArrowLeft') return clampSidebarWidth(width - SIDEBAR_WIDTH.step);
    if (key === 'ArrowRight') return clampSidebarWidth(width + SIDEBAR_WIDTH.step);
    if (key === 'Home') return SIDEBAR_WIDTH.min;
    if (key === 'End') return SIDEBAR_WIDTH.max;
    return null;
}

export function SidebarResizer() {
    const h = React.createElement;
    const [width, setWidth] = React.useState(() => storedSidebarWidth());
    React.useEffect(() => { applySidebarWidth(width); }, []);
    function update(next, save) {
        setWidth(applySidebarWidth(next, { save }));
    }
    function startDrag(event) {
        if (event.button !== 0) return;
        event.preventDefault();
        document.body.classList.add('is-resizing-sidebar');
        let latest = width;
        const move = moveEvent => { latest = clampSidebarWidth(moveEvent.clientX); update(latest, false); };
        const stop = () => {
            document.body.classList.remove('is-resizing-sidebar');
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', stop);
            update(latest, true);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', stop);
    }
    return h('div', {
        className: 'app-sidebar__resizer', role: 'separator', tabIndex: 0, 'aria-orientation': 'vertical',
        'aria-label': 'Resize navigation', 'aria-valuemin': SIDEBAR_WIDTH.min, 'aria-valuemax': SIDEBAR_WIDTH.max, 'aria-valuenow': width,
        title: 'Drag to resize the navigation. Double-click to reset.',
        onPointerDown: startDrag,
        onDoubleClick: () => update(SIDEBAR_WIDTH.default, true),
        onKeyDown: event => {
            const next = sidebarWidthForKey(event.key, width);
            if (next === null) return;
            event.preventDefault();
            update(next, true);
        },
    });
}

// Apply a saved width as soon as the sidebar module loads, before the first paint of the page.
if (typeof document !== 'undefined') applySidebarWidth(storedSidebarWidth());
