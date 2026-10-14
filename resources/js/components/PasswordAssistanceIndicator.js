import { apiRequest } from '../api/api-client.js';
import { can } from '../access/access-session.js';

export function PasswordAssistanceIndicator({ session }) {
    const [count, setCount] = React.useState(null);
    const [failed, setFailed] = React.useState(false);

    const allowed =
        [
            'Technical Administrator',
            'Technical Admin',
            'Administrator',
            'test',
        ].includes(session?.roleName) &&
        can('users.update', session);

    React.useEffect(() => {
        if (!allowed) return;

        let cancelled = false;
        let running = false;

        async function refresh() {
            if (running) return;
            running = true;

            try {
                const payload = await apiRequest(
                    '/api/password-assistance-requests?status=pending&per_page=1',
                    { redirectOnUnauthorized: false }
                );

                if (!cancelled) {
                    setCount(payload.meta.pending_count);
                    setFailed(false);
                }
            } catch {
                if (!cancelled) setFailed(true);
            } finally {
                running = false;
            }
        }

        refresh();
        const timer = window.setInterval(refresh, 30000);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
    }, [allowed, session?.userId]);

    if (!allowed) return null;

    return React.createElement(
        'a',
        {
            className: 'app-sidebar__item',
            href: '/user-management#password-assistance-title',
        },
        React.createElement('i', {
            className: 'bi bi-key',
            'aria-hidden': true,
        }),
        React.createElement('span', null, 'Password Assistance'),
        React.createElement(
            'small',
            { 'aria-live': 'polite' },
            failed
                ? 'Unavailable'
                : count === null
                    ? 'Loading…'
                    : `${count} pending`
        )
    );
}