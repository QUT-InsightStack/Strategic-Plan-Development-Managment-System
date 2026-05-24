const { useState, useEffect } = React;
const rootElement = document.getElementById('root');
const crud = window.ResourceCrud;
const resourceName = new URLSearchParams(window.location.search).get('resource') || '';
const schema = crud.getSchema(resourceName);

function Brand() {
    return React.createElement(
        'a',
        { className: 'brand', href: '/dashboard.html', 'aria-label': 'Strategic planning Management System home' },
        React.createElement(
            'span',
            { className: 'brand-mark', 'aria-hidden': 'true' },
            React.createElement('span'),
            React.createElement('span'),
            React.createElement('span'),
            React.createElement('span')
        ),
        React.createElement('span', { className: 'brand-name' }, 'Strategic planning Management System')
    );
}

function Header({ onMessage, onLogout }) {
    return React.createElement(
        'header',
        { className: 'app-header', 'aria-label': 'Application header' },
        React.createElement(Brand),
        React.createElement(
            'nav',
            { className: 'top-nav', 'aria-label': 'Primary navigation' },
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => window.location.href = '/dashboard.html' }, 'Dashboard'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => window.location.href = '/profile.html' }, 'Profile'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(crud.messages.help) }, 'Help'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(crud.messages.contact) }, 'Contact'),
            React.createElement('button', { className: 'nav-link logout-link', type: 'button', onClick: onLogout }, 'Logout')
        )
    );
}

function getColumns(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }

    const firstItem = items[0];
    const preferred = (schema?.displayColumns || []).filter((column) => Object.prototype.hasOwnProperty.call(firstItem, column));
    const extras = Object.keys(firstItem)
        .filter((column) => !preferred.includes(column))
        .filter((column) => typeof firstItem[column] !== 'object')
        .slice(0, 4);

    return [...preferred, ...extras].slice(0, 9);
}

function itemMatchesSearch(item, searchTerm) {
    if (!searchTerm.trim()) {
        return true;
    }

    const needle = searchTerm.trim().toLowerCase();
    return Object.values(item).some((value) => crud.formatCellValue(value).toLowerCase().includes(needle));
}

function ResourceToolbar({ searchTerm, selectedCount, onSearchChange, onBulkDelete }) {
    return React.createElement(
        'section',
        { className: 'resource-filter-card modern-card', 'aria-label': 'Search and filter' },
        React.createElement('h2', null, 'Search and filter'),
        React.createElement(
            'div',
            { className: 'resource-filter-row' },
            React.createElement('input', {
                className: 'crud-input resource-search-input',
                type: 'search',
                value: searchTerm,
                placeholder: 'Search',
                onChange: (event) => onSearchChange(event.target.value),
            }),
            React.createElement(
                'button',
                { className: 'action-button secondary', type: 'button', onClick: () => onSearchChange('') },
                'Clear'
            ),
            React.createElement(
                'button',
                { className: 'action-button danger', type: 'button', disabled: selectedCount === 0, onClick: onBulkDelete },
                `Bulk Delete${selectedCount ? ` (${selectedCount})` : ''}`
            )
        )
    );
}

function ResourceTable({ items, selectedIds, onToggleOne, onToggleAll, onDelete }) {
    if (!Array.isArray(items)) {
        return React.createElement('pre', null, JSON.stringify(items, null, 2));
    }

    if (items.length === 0) {
        return React.createElement(
            'div',
            { className: 'empty-state' },
            React.createElement('h2', null, 'No records found'),
            React.createElement('p', null, 'Create the first record to start managing this resource.')
        );
    }

    const columns = getColumns(items);
    const selectableItems = items.filter((item) => crud.resolveId(resourceName, item));
    const allSelected = selectableItems.length > 0 && selectableItems.every((item) => selectedIds.includes(String(crud.resolveId(resourceName, item))));

    return React.createElement(
        'table',
        { className: 'resource-table' },
        React.createElement(
            'thead',
            null,
            React.createElement(
                'tr',
                null,
                React.createElement(
                    'th',
                    { className: 'checkbox-cell' },
                    React.createElement('input', {
                        type: 'checkbox',
                        checked: allSelected,
                        onChange: (event) => onToggleAll(event.target.checked, selectableItems),
                        'aria-label': 'Select all rows',
                    })
                ),
                columns.map((column) => React.createElement('th', { key: column }, crud.formatLabel(column))),
                React.createElement('th', { key: 'actions' }, 'Actions')
            )
        ),
        React.createElement(
            'tbody',
            null,
            items.slice(0, 50).map((item, index) => {
                const id = crud.resolveId(resourceName, item);
                const idString = id ? String(id) : '';

                return React.createElement(
                    'tr',
                    { key: id || index },
                    React.createElement(
                        'td',
                        { className: 'checkbox-cell', 'data-label': 'Select' },
                        id
                            ? React.createElement('input', {
                                  type: 'checkbox',
                                  checked: selectedIds.includes(idString),
                                  onChange: (event) => onToggleOne(idString, event.target.checked),
                                  'aria-label': `Select ${schema.singular.toLowerCase()} ${id}`,
                              })
                            : null
                    ),
                    columns.map((column) =>
                        React.createElement(
                            'td',
                            { key: `${id || index}-${column}`, 'data-label': crud.formatLabel(column) },
                            React.createElement('span', { className: 'resource-cell-text' }, crud.formatCellValue(item[column]))
                        )
                    ),
                    React.createElement(
                        'td',
                        { className: 'action-cell', 'data-label': 'Actions' },
                        id
                            ? React.createElement(
                                  'div',
                                  { className: 'table-actions' },
                                  React.createElement(
                                      'a',
                                      {
                                          className: 'action-button secondary',
                                          href: `/resource-form.html?resource=${resourceName}&id=${id}`,
                                      },
                                      'Edit'
                                  ),
                                  React.createElement(
                                      'button',
                                      {
                                          className: 'action-button danger',
                                          type: 'button',
                                          onClick: () => onDelete(item),
                                      },
                                      'Delete'
                                  )
                              )
                            : React.createElement('span', null, 'No id')
                    )
                );
            })
        )
    );
}

function ResourceApp() {
    const [items, setItems] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState({ message: '', type: 'info' });
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        loadResource();
    }, [refreshKey]);

    function setStatusMessage(message, type = 'info') {
        setStatus({ message, type });
    }

    function handleLogout() {
        crud.requestJson('/api/logout', { method: 'POST' })
            .catch(() => null)
            .finally(() => {
                localStorage.removeItem('auth_token');
                window.location.href = '/login.html';
            });
    }

    async function loadResource() {
        if (!resourceName || !schema) {
            setStatusMessage('Resource not specified. Use dashboard links to select a resource.', 'error');
            setLoading(false);
            return;
        }

        setLoading(true);
        setStatusMessage(`Loading ${schema.title.toLowerCase()}...`, 'info');

        try {
            const response = await crud.listResource(resourceName);
            const loaded = response.data;
            setItems(Array.isArray(loaded) ? loaded : [loaded]);
            setSelectedIds([]);
            setStatusMessage(`${schema.title} loaded${response.source === 'api' ? '' : ' from sample data'}.`, 'success');
        } catch (error) {
            setStatusMessage(error.message || 'Unable to load the selected resource.', 'error');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }

    function handleRefresh() {
        setRefreshKey((current) => current + 1);
    }

    function handleToggleOne(id, checked) {
        setSelectedIds((current) => (checked ? [...new Set([...current, id])] : current.filter((item) => item !== id)));
    }

    function handleToggleAll(checked, rows) {
        setSelectedIds(checked ? rows.map((item) => String(crud.resolveId(resourceName, item))) : []);
    }

    async function handleBulkDelete() {
        if (selectedIds.length === 0) {
            return;
        }

        const confirmed = window.confirm(`Delete ${selectedIds.length} selected ${schema.title.toLowerCase()} record(s)?`);

        if (!confirmed) {
            return;
        }

        setStatusMessage('Deleting selected records...', 'info');

        try {
            await Promise.all(selectedIds.map((id) => crud.deleteResource(resourceName, id)));
            setStatusMessage('Selected records deleted successfully.', 'success');
            handleRefresh();
        } catch (error) {
            setStatusMessage(error.message || 'Failed to delete selected records.', 'error');
        }
    }

    async function handleDelete(item) {
        const id = crud.resolveId(resourceName, item);

        if (!id) {
            setStatusMessage('Unable to delete item: no identifiable ID property.', 'error');
            return;
        }

        const confirmed = window.confirm(`Delete this ${schema.singular.toLowerCase()}?`);

        if (!confirmed) {
            return;
        }

        setStatusMessage('Deleting record...', 'info');

        try {
            const response = await crud.deleteResource(resourceName, id);
            setStatusMessage('Record deleted successfully.', 'success');
            handleRefresh();
        } catch (error) {
            setStatusMessage(error.message || 'Failed to delete record.', 'error');
        }
    }

    const visibleItems = items.filter((item) => itemMatchesSearch(item, searchTerm));

    return React.createElement(
        'div',
        { className: 'profile-shell with-sidebar' },
        React.createElement(window.AppShell.Sidebar, { activeResource: resourceName, onMessage: setStatusMessage, onLogout: handleLogout }),
        React.createElement(
            'main',
            { className: 'profile-main' },
            React.createElement(
                'div',
                { className: 'page-inner' },
                React.createElement(
                    'div',
                    { className: 'page-title' },
                    React.createElement('h1', null, schema ? `Manage ${schema.title}` : 'Resource Explorer'),
                    React.createElement('p', null, schema ? `Create, update, review, and delete ${schema.title.toLowerCase()}.` : 'Choose a resource from the dashboard.')
                ),
                React.createElement(
                    'div',
                    { className: 'resource-header-actions' },
                    schema
                        ? React.createElement(
                              'a',
                              { className: 'action-button primary', href: `/resource-form.html?resource=${resourceName}` },
                              `Create ${schema.singular}`
                          )
                        : null,
                    React.createElement(
                        'button',
                        { className: 'action-button secondary', type: 'button', onClick: handleRefresh },
                        'Refresh'
                    ),
                    React.createElement(
                        'a',
                        { className: 'action-button secondary', href: '/dashboard.html' },
                        'Back to Dashboard'
                    )
                ),
                React.createElement(ResourceToolbar, {
                    searchTerm,
                    selectedCount: selectedIds.length,
                    onSearchChange: setSearchTerm,
                    onBulkDelete: handleBulkDelete,
                }),
                React.createElement(
                    'div',
                    { className: 'resource-card modern-card' },
                    loading
                        ? React.createElement('p', { className: 'empty-state' }, 'Loading records...')
                        : React.createElement(ResourceTable, {
                              items: visibleItems,
                              selectedIds,
                              onToggleOne: handleToggleOne,
                              onToggleAll: handleToggleAll,
                              onDelete: handleDelete,
                          })
                ),
                React.createElement(
                    'p',
                    { className: `form-status modern-status is-${status.type}` },
                    status.message
                )
            )
        )
    );
}

ReactDOM.createRoot(rootElement).render(React.createElement(ResourceApp));
