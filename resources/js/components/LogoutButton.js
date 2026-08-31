import '../../css/components/dialog.css';
import { logout } from '../auth-session.js';
import { AppDialog } from './AppDialog.js';

export function LogoutButton({ className = 'nav-link logout-link', label = 'Logout', iconClass = '', onError = () => {} }) {
    const [open, setOpen] = React.useState(false);
    const [loggingOut, setLoggingOut] = React.useState(false);

    function confirmLogout() {
        setLoggingOut(true);
        logout({ onError });
    }

    return React.createElement(React.Fragment, null,
        React.createElement('button', {
            className,
            type: 'button',
            disabled: loggingOut,
            onClick: () => setOpen(true),
        },
            iconClass ? React.createElement('i', { className: iconClass }) : null,
            React.createElement('span', null, loggingOut ? 'Signing out...' : label)
        ),
        React.createElement(AppDialog, {
            open,
            variant: 'danger',
            title: 'Confirm Logout',
            message: 'Are you sure you want to log out of the Strategic Planning Management System?',
            confirmLabel: 'Log Out',
            cancelLabel: 'Cancel',
            onConfirm: confirmLogout,
            onCancel: () => setOpen(false),
        })
    );
}
