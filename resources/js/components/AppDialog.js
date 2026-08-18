export function AppDialog({ open, variant = 'success', title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }) {
    if (!open) return null;

    const isDanger = variant === 'danger';
    const isError = variant === 'error';
    return React.createElement('div', { className: 'ui-dialog-backdrop', role: 'presentation' },
        React.createElement('section', {
            className: `ui-dialog ui-dialog--${variant}`,
            role: isDanger || isError ? 'alertdialog' : 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'ui-dialog-title',
            'aria-describedby': 'ui-dialog-message',
        },
            React.createElement('div', { className: 'ui-dialog__icon', 'aria-hidden': 'true' }, React.createElement('i', { className: `bi ${isDanger || isError ? 'bi-exclamation-lg' : 'bi-check-lg'}` })),
            React.createElement('h2', { id: 'ui-dialog-title' }, title),
            React.createElement('p', { id: 'ui-dialog-message' }, message),
            React.createElement('div', { className: 'ui-dialog__actions' },
                isDanger ? React.createElement('button', { className: 'ui-button ui-button--secondary', type: 'button', onClick: onCancel }, cancelLabel) : null,
                React.createElement('button', { className: `ui-button ${isDanger ? 'ui-button--danger-solid' : 'ui-button--success'}`, type: 'button', onClick: onConfirm }, confirmLabel)
            )
        )
    );
}
