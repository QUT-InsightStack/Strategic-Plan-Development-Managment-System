import '../../resource-crud-config.js';
import { BrandLogo } from '../../brand-logo.js';
import { logout, guardAgainstBackNavigation } from '../../auth-session.js';
import { LogoutButton } from '../../components/LogoutButton.js';
import { resourceRequest } from '../../api/resource-api.js';

const { useState, useEffect } = React;
const rootElement = document.getElementById('root');
const crud = window.ResourceCrud;
const dashboardUrl = '/dashboard';
const profileUrl = '/profile';
const resourceUrl = '/resource';
const resourceFormUrl = '/resource-form';
const loginUrl = '/login';
const resourceName = new URLSearchParams(window.location.search).get('resource') || '';
const apiUrl = resourceName ? `/api/${resourceName}` : '';
const schema = crud.getSchema(resourceName);

function Brand() {
    return React.createElement(
        'a',
        { className: 'brand', href: dashboardUrl, 'aria-label': 'Strategic Planning Management System home' },
        React.createElement(BrandLogo),
        React.createElement('span', { className: 'brand-name' }, 'Strategic Planning Management System')
    );
}

function Header({ onMessage, onLogout, loggingOut }) {
    return React.createElement(
        'header',
        { className: 'app-header', 'aria-label': 'Application header' },
        React.createElement(Brand),
        React.createElement(
            'nav',
            { className: 'top-nav', 'aria-label': 'Primary navigation' },
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => window.location.href = dashboardUrl }, 'Dashboard'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => window.location.href = profileUrl }, 'Profile'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(crud.messages.help) }, 'Help'),
            React.createElement('button', { className: 'nav-link', type: 'button', onClick: () => onMessage(crud.messages.contact) }, 'Contact'),
            React.createElement(LogoutButton)
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

function ResourceTable({ items, onDelete }) {
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

    return React.createElement(
        'table',
        { className: 'resource-table' },
        React.createElement(
            'thead',
            null,
            React.createElement(
                'tr',
                null,
                columns.map((column) => React.createElement('th', { key: column }, crud.formatLabel(column))),
                React.createElement('th', { key: 'actions' }, 'Actions')
            )
        ),
        React.createElement(
            'tbody',
            null,
            items.slice(0, 50).map((item, index) => {
                const id = crud.resolveId(resourceName, item);

                return React.createElement(
                    'tr',
                    { key: id || index },
                    columns.map((column) =>
                        React.createElement(
                            'td',
                            { key: `${id || index}-${column}`, 'data-label': crud.formatLabel(column) },
                            React.createElement('span', { className: 'resource-cell-text' }, crud.formatCellValue(item[column], column))
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
                                          href: `${resourceFormUrl}?resource=${resourceName}&id=${id}`,
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
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState({ message: '', type: 'info' });
    const [loggingOut, setLoggingOut] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        guardAgainstBackNavigation();
    }, []);

    useEffect(() => {
        loadResource();
    }, [refreshKey]);

    function setStatusMessage(message, type = 'info') {
        setStatus({ message, type });
    }

    function handleLogout() {
        logout({
            onStart: () => {
                setLoggingOut(true);
                setStatusMessage('Signing you out...', 'info');
            },
            onError: (message) => setStatusMessage(message, 'error'),
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
            const response = await resourceRequest(apiUrl);
            const loaded = crud.extractData(response);
            setItems(Array.isArray(loaded) ? loaded : [loaded]);
            setStatusMessage(`${schema.title} loaded.`, 'success');
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
            await resourceRequest(`${apiUrl}/${id}`, { method: 'DELETE' });
            setStatusMessage('Record deleted successfully.', 'success');
            handleRefresh();
        } catch (error) {
            setStatusMessage(error.message || 'Failed to delete record.', 'error');
        }
    }

    return React.createElement(
        'div',
        { className: 'profile-shell' },
        React.createElement(Header, { onMessage: setStatusMessage, onLogout: handleLogout, loggingOut }),
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
                              { className: 'action-button primary', href: `${resourceFormUrl}?resource=${resourceName}` },
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
                        { className: 'action-button secondary', href: dashboardUrl },
                        'Back to Dashboard'
                    )
                ),
                React.createElement(
                    'div',
                    { className: 'resource-card modern-card' },
                    loading
                        ? React.createElement('p', { className: 'empty-state' }, 'Loading records...')
                        : React.createElement(ResourceTable, { items, onDelete: handleDelete })
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
