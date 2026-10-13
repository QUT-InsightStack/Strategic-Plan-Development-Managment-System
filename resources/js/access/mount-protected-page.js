import { createPageRoot } from '../navigation/page-root.js';
import { loadAccessSession } from './use-access-session.js';
import { enforcePageAccess } from './access-guard.js';

// Evaluate page permissions only after the current account has been refreshed.
export function mountProtectedPage(element, renderPage) {
    const root = createPageRoot(element);
    async function mount() {
        root.render(React.createElement('p', { role: 'status', className: 'p-4' }, 'Loading account permissions…'));
        try {
            await loadAccessSession();
            if (enforcePageAccess()) root.render(renderPage());
        } catch (error) {
            root.render(React.createElement('div', { role: 'alert', className: 'p-4' },
                React.createElement('p', null, error.message || 'Unable to load account permissions.'),
                React.createElement('button', { className: 'ui-button', onClick: mount }, 'Retry'),
                React.createElement('a', { className: 'ui-button', href: '/login' }, 'Sign in')));
        }
    }
    mount();
    return root;
}
