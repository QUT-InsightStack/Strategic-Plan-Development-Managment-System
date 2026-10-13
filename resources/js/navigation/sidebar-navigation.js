import { unmountPages } from './page-root.js';
import { invalidateAccessSession } from '../access/use-access-session.js';

let installed = false;
let navigating = false;
let currentUrl;
let pendingVisit;
let cleanupTransition = () => {};

export function shouldHandleLink(event, anchor, origin) {
    return !event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey
        && !event.shiftKey && !event.altKey && !anchor.hasAttribute('download')
        && (!anchor.target || anchor.target === '_self') && new URL(anchor.href).origin === origin;
}

function loadStyle(source) {
    if ([...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === source.href)) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const link = source.cloneNode();
        link.dataset.navigationStyle = 'true';
        link.onload = resolve;
        link.onerror = () => { link.remove(); reject(new Error('Page styles could not be loaded.')); };
        document.head.append(link);
    });
}

async function visit(href, historyVisit = false) {
    if (navigating) { pendingVisit = [href, historyVisit]; return; }
    const target = new URL(href, location.href);
    if (target.href === currentUrl) return;
    if (!window.dispatchEvent(new Event('app:before-navigate', { cancelable: true }))
        && !window.confirm('There are unsaved changes or an operation in progress. Leave this page?')) {
        if (historyVisit) history.pushState(null, '', currentUrl);
        return;
    }
    navigating = true;
    cleanupTransition();
    const previousStyles = [...document.querySelectorAll('link[rel="stylesheet"]')];
    const sidebar = document.querySelector('.app-sidebar');
    sidebar?.setAttribute('aria-busy', 'true');
    let switched = false;
    try {
        const response = await fetch(target.href, { credentials: 'same-origin', headers: { Accept: 'text/html' } });
        if (response.redirected) { location.assign(response.url); return; }
        if (!response.ok) throw new Error(`Page could not be loaded (${response.status}). Please try again.`);
        const next = new DOMParser().parseFromString(await response.text(), 'text/html');
        const entry = next.querySelector('meta[name="app-page-entry"]')?.content;
        const nextRoot = next.getElementById('root');
        if (!entry || !nextRoot) { location.assign(target.href); return; }
        const styles = [...next.querySelectorAll('link[rel="stylesheet"]')];
        await Promise.all(styles.map(loadStyle));

        // Retain the visible sidebar until the next React page has rendered its own.
        const retained = sidebar?.cloneNode(true);
        if (retained) {
            retained.inert = true;
            retained.dataset.navigationRetained = 'true';
            retained.scrollTop = sidebar.scrollTop;
            document.body.append(retained);
        }
        unmountPages();
        invalidateAccessSession();
        document.getElementById('root').replaceWith(document.importNode(nextRoot, true));
        document.body.className = next.body.className;
        document.title = next.title;
        if (!historyVisit) history.pushState(null, '', target.href);
        currentUrl = target.href;
        switched = true;
        // Only the entry module is re-executed; shared modules retain a single lifecycle.
        const moduleUrl = new URL(entry, location.href);
        moduleUrl.searchParams.set('navigation', String(Date.now()) + Math.random().toString(36).slice(2));
        await import(/* @vite-ignore */ moduleUrl.href);
        const finish = () => {
            const content = document.getElementById('root')?.firstElementChild;
            if (!content || (content.tagName === 'P' && content.getAttribute('role') === 'status')) return false;
            retained?.remove();
            const required = new Set(styles.map(link => link.href));
            for (const link of previousStyles) {
                if (new URL(link.href).origin === location.origin && !required.has(link.href)) link.remove();
            }
            return true;
        };
        if (!finish()) {
            const observer = new MutationObserver(() => { if (finish()) { observer.disconnect(); clearTimeout(timer); } });
            observer.observe(document.getElementById('root'), { childList: true, subtree: true });
            const timer = setTimeout(() => { observer.disconnect(); retained?.remove(); }, 15000);
            cleanupTransition = () => { observer.disconnect(); clearTimeout(timer); retained?.remove(); };
        }
        window.scrollTo(0, 0);
    } catch (error) {
        if (switched || historyVisit) { location.assign(target.href); return; }
        document.getElementById('navigation-error')?.remove();
        const message = document.createElement('div');
        message.id = 'navigation-error';
        message.setAttribute('role', 'alert');
        message.className = 'navigation-error';
        message.textContent = error.message;
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.textContent = 'Dismiss';
        dismiss.onclick = () => message.remove();
        message.append(dismiss);
        document.body.append(message);
    } finally {
        navigating = false;
        sidebar?.removeAttribute('aria-busy');
        if (pendingVisit) {
            const next = pendingVisit;
            pendingVisit = null;
            visit(...next);
        }
    }
}

export function installSidebarNavigation() {
    if (installed) return;
    installed = true;
    currentUrl = location.href;
    document.addEventListener('click', event => {
        const anchor = event.target.closest?.('.app-sidebar a[href]');
        if (!anchor || !shouldHandleLink(event, anchor, location.origin)) return;
        event.preventDefault();
        visit(anchor.href);
    });
    window.addEventListener('popstate', () => {
        visit(location.href, true);
    });
}
