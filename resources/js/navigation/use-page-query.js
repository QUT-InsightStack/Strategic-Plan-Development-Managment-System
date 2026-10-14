import { getAccessSession } from '../access/access-session.js';
import { pageForUrl, canOpenPage } from '../access/navigation.js';

// Pages opt in only when they can render query changes without remounting.
export function usePageQuery() {
    const [search, setSearch] = React.useState(() => new URLSearchParams(window.location.search));
    React.useEffect(() => {
        const pathname = window.location.pathname;
        function navigate(event) {
            const target = new URL(event.detail.href);
            if (target.pathname !== pathname) return;
            const session = getAccessSession();
            const page = session && pageForUrl(target.href, session.roleName);
            if (!page || !canOpenPage(page, session)) return;
            event.preventDefault();
            setSearch(new URLSearchParams(target.search));
        }
        window.addEventListener('app:query-navigate', navigate);
        return () => window.removeEventListener('app:query-navigate', navigate);
    }, []);
    return search;
}
