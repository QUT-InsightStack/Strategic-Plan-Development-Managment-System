import '../../css/components/dialog.css';
import '../../css/components/logout-dialog.css';
import { logout } from '../auth-session.js';
import { getAccessSession } from '../access/access-session.js';
import { useDialogBehaviour } from './use-dialog-behaviour.js';

const h = React.createElement;

function LogoutIcon() {
    return h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' },
        h('path', { d: 'M10 3a1 1 0 0 1 0 2H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4a1 1 0 1 1 0 2H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h4Zm6.3 4.3a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1 0 1.4l-4 4a1 1 0 0 1-1.4-1.4l2.3-2.3H9a1 1 0 1 1 0-2h9.6l-2.3-2.3a1 1 0 0 1 0-1.4Z' }));
}

/**
 * Confirmation shown before signing out.
 *
 * Logging out is not destructive, so it uses a neutral dialog rather than the
 * red warning style. It keeps focus inside while open, closes on Escape or a
 * backdrop click, returns focus to the Log Out control on cancel, and stays
 * open with a progress state while the session is being ended.
 */
function LogoutDialog({ open, signingOut, onConfirm, onCancel }) {
    const ref = useDialogBehaviour(open, () => { if (!signingOut) onCancel(); });
    if (!open) return null;

    const session = getAccessSession();
    const who = session?.name ? `You are signed in as ${session.name}.` : '';

    return h('div', {
        className: 'logout-dialog-backdrop',
        role: 'presentation',
        onMouseDown: (event) => { if (event.target === event.currentTarget && !signingOut) onCancel(); },
    },
        h('section', {
            ref,
            className: 'logout-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'logout-dialog-title',
            'aria-describedby': 'logout-dialog-message',
            'aria-busy': signingOut ? 'true' : undefined,
        },
            h('div', { className: 'logout-dialog__icon' }, h(LogoutIcon)),
            h('h2', { id: 'logout-dialog-title' }, signingOut ? 'Signing you out…' : 'Log out?'),
            h('p', { id: 'logout-dialog-message' },
                signingOut
                    ? 'Ending your session securely. You will be taken to the sign-in page.'
                    : `${who} You will need to sign in again to continue. Any unsaved changes on this page will be lost.`.trim()),
            h('div', { className: 'logout-dialog__actions' },
                h('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: onCancel, disabled: signingOut }, 'Stay signed in'),
                h('button', { className: 'ui-button ui-button--primary logout-dialog__confirm', type: 'button', onClick: onConfirm, disabled: signingOut },
                    signingOut ? h('span', { className: 'logout-dialog__spinner', 'aria-hidden': 'true' }) : null,
                    signingOut ? 'Signing out…' : 'Log out'))));
}

export function LogoutButton({ className = 'nav-link logout-link', label = 'Logout', iconClass = '', onError = () => {} }) {
    const [open, setOpen] = React.useState(false);
    const [loggingOut, setLoggingOut] = React.useState(false);

    function confirmLogout() {
        if (loggingOut) return;
        setLoggingOut(true);
        logout({ onError, reason: 'manual' });
    }

    return h(React.Fragment, null,
        h('button', {
            className,
            type: 'button',
            disabled: loggingOut,
            'aria-haspopup': 'dialog',
            onClick: () => setOpen(true),
        },
            iconClass ? h('i', { className: iconClass, 'aria-hidden': 'true' }) : null,
            h('span', null, loggingOut ? 'Signing out...' : label)
        ),
        h(LogoutDialog, {
            open,
            signingOut: loggingOut,
            onConfirm: confirmLogout,
            onCancel: () => setOpen(false),
        })
    );
}
