const { useId, useState } = React;

export function AdministrativeActionMenu({ actions = [], label = 'Actions' }) {
    const [open, setOpen] = useState(false);
    const menuId = useId();

    function select(action) {
        setOpen(false);
        action.onSelect?.();
    }

    return React.createElement('div', { className: 'admin-action-menu' },
        React.createElement('button', {
            className: 'ui-button ui-button--secondary ui-button--sm admin-action-menu__trigger',
            type: 'button',
            'aria-expanded': open,
            'aria-controls': menuId,
            onClick: () => setOpen((current) => !current),
        }, label, React.createElement('i', { className: `bi bi-chevron-${open ? 'up' : 'down'}`, 'aria-hidden': 'true' })),
        open ? React.createElement('div', { className: 'admin-action-menu__items', id: menuId, role: 'menu' },
            actions.map((action) => React.createElement('button', {
                key: action.label,
                className: `admin-action-menu__item${action.tone === 'danger' ? ' admin-action-menu__item--danger' : ''}`,
                type: 'button',
                role: 'menuitem',
                onClick: () => select(action),
            }, React.createElement('i', { className: `bi ${action.icon}`, 'aria-hidden': 'true' }), React.createElement('span', null, action.label)))
        ) : null
    );
}
