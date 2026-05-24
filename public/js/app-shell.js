(function () {
    const menuGroups = [
        {
            id: 'planning',
            label: 'Planning Module',
            icon: 'clipboard',
            resources: ['strategic-records', 'missions', 'visions', 'core-values'],
            children: [
                { label: 'Strategic Plans', href: '/resource.html?resource=strategic-records', resource: 'strategic-records' },
                { label: 'Mission', href: '/resource.html?resource=missions', resource: 'missions' },
                { label: 'Vision', href: '/resource.html?resource=visions', resource: 'visions' },
                { label: 'Core Values', href: '/resource.html?resource=core-values', resource: 'core-values' },
            ],
        },
        {
            id: 'mapping',
            label: 'Mapping Module',
            icon: 'map',
            resources: ['relations', 'role-premissions', 'plan-core-values'],
            children: [
                { label: 'Relations', href: '/resource.html?resource=relations', resource: 'relations' },
                { label: 'Plan/Core Mapping', href: '/resource.html?resource=plan-core-values', resource: 'plan-core-values' },
                { label: 'Role Permissions', href: '/resource.html?resource=role-premissions', resource: 'role-premissions' },
            ],
        },
        {
            id: 'admin',
            label: 'Administration',
            icon: 'building',
            resources: ['users', 'roles', 'permissions'],
            children: [
                { label: 'Users', href: '/resource.html?resource=users', resource: 'users' },
                { label: 'Roles', href: '/resource.html?resource=roles', resource: 'roles' },
                { label: 'Permissions', href: '/resource.html?resource=permissions', resource: 'permissions' },
            ],
        },
    ];

    const iconPaths = {
        home: 'M4 11.5 12 5l8 6.5V20h-5v-5H9v5H4v-8.5Z',
        clipboard: 'M8 4h8v3H8V4Zm-3 2h3v2h8V6h3v15H5V6Zm4 6h6v2H9v-2Zm0 4h6v2H9v-2Z',
        map: 'M4 5 9 3l6 2 5-2v16l-5 2-6-2-5 2V5Zm6 0v12l4 1.3v-12L10 5Z',
        gauge: 'M12 5a9 9 0 0 1 9 9h-3a6 6 0 0 0-12 0H3a9 9 0 0 1 9-9Zm1 10h-2l3-6 2 1-3 5Z',
        help: 'M11 16h2v-2h-2v2Zm1-12a5 5 0 0 0-5 5h2a3 3 0 1 1 4.2 2.7c-1.2.5-2.2 1.5-2.2 3.3h2c0-.9.4-1.2 1.2-1.6A5 5 0 0 0 12 4Z',
        report: 'M6 3h9l4 4v14H6V3Zm8 1.5V8h3.5L14 4.5ZM8 12h8v2H8v-2Zm0 4h8v2H8v-2Z',
        logout: 'M10 4h8v16h-8v-2h6V6h-6V4Zm-1 4 1.4 1.4L8.8 11H18v2H8.8l1.6 1.6L9 16l-4-4 4-4Z',
        building: 'M4 21V5l8-3 8 3v16h-6v-5h-4v5H4Zm4-10h2V8H8v3Zm6 0h2V8h-2v3Z',
        chevron: 'M8.5 5.5 15 12l-6.5 6.5L7 17l5-5-5-5 1.5-1.5Z',
        collapse: 'M11 5 4 12l7 7 1.4-1.4L7.8 13H20v-2H7.8l4.6-4.6L11 5Z',
    };

    function Icon({ name }) {
        return React.createElement(
            'span',
            { className: 'sidebar-icon', 'aria-hidden': 'true' },
            React.createElement(
                'svg',
                { viewBox: '0 0 24 24' },
                React.createElement('path', { d: iconPaths[name] || iconPaths.home })
            )
        );
    }

    function Sidebar({ active = '', activeResource = '', onMessage, onLogout }) {
        const [collapsed, setCollapsed] = React.useState(false);
        const [openGroups, setOpenGroups] = React.useState(() =>
            menuGroups.reduce((acc, group) => {
                acc[group.id] = activeResource ? group.resources.includes(activeResource) : group.id === 'planning';
                return acc;
            }, {})
        );

        function toggleGroup(groupId) {
            setOpenGroups((current) => ({ ...current, [groupId]: !current[groupId] }));
        }

        function sendMessage(message) {
            if (typeof onMessage === 'function') {
                onMessage(message);
            }
        }

        return React.createElement(
            'aside',
            { className: `app-sidebar ${collapsed ? 'is-collapsed' : ''}` },
            React.createElement(
                'a',
                { className: 'sidebar-brand', href: '/dashboard.html', 'aria-label': 'SPDMS dashboard' },
                React.createElement(
                    'span',
                    { className: 'sidebar-brand-mark', 'aria-hidden': 'true' },
                    React.createElement('span'),
                    React.createElement('span'),
                    React.createElement('span'),
                    React.createElement('span')
                ),
                React.createElement(
                    'span',
                    { className: 'sidebar-brand-copy' },
                    React.createElement('strong', null, 'SPDMS'),
                    React.createElement('small', null, 'Strategic Planning System')
                )
            ),
            React.createElement(
                'div',
                { className: 'sidebar-user' },
                React.createElement(Icon, { name: 'clipboard' }),
                React.createElement('span', null, 'Planner/encoder')
            ),
            React.createElement(
                'nav',
                { className: 'sidebar-nav', 'aria-label': 'Sidebar navigation' },
                React.createElement(
                    'a',
                    { className: `sidebar-link ${active === 'home' ? 'is-active' : ''}`, href: '/dashboard.html' },
                    React.createElement(Icon, { name: 'home' }),
                    React.createElement('span', null, 'Home')
                ),
                menuGroups.map((group) =>
                    React.createElement(
                        'div',
                        { className: `sidebar-group ${openGroups[group.id] ? 'is-open' : ''}`, key: group.id },
                        React.createElement(
                            'button',
                            {
                                className: `sidebar-link sidebar-group-toggle ${group.resources.includes(activeResource) ? 'is-active' : ''}`,
                                type: 'button',
                                onClick: () => toggleGroup(group.id),
                                'aria-expanded': openGroups[group.id],
                            },
                            React.createElement(Icon, { name: group.icon }),
                            React.createElement('span', null, group.label),
                            React.createElement(Icon, { name: 'chevron' })
                        ),
                        React.createElement(
                            'div',
                            { className: 'sidebar-subnav' },
                            group.children.map((item) =>
                                React.createElement(
                                    'a',
                                    {
                                        className: `sidebar-sublink ${activeResource === item.resource ? 'is-active' : ''}`,
                                        href: item.href,
                                        key: item.resource,
                                    },
                                    item.label
                                )
                            )
                        )
                    )
                ),
                React.createElement(
                    'a',
                    { className: `sidebar-link ${active === 'dashboard' ? 'is-active' : ''}`, href: '/dashboard.html' },
                    React.createElement(Icon, { name: 'gauge' }),
                    React.createElement('span', null, 'Dashboard')
                ),
                React.createElement(
                    'button',
                    { className: 'sidebar-link', type: 'button', onClick: () => sendMessage('FAQ content is not connected yet.') },
                    React.createElement(Icon, { name: 'help' }),
                    React.createElement('span', null, 'FQA')
                ),
                React.createElement(
                    'a',
                    { className: `sidebar-link ${activeResource === 'logs' ? 'is-active' : ''}`, href: '/resource.html?resource=logs' },
                    React.createElement(Icon, { name: 'report' }),
                    React.createElement('span', null, 'Report')
                ),
                React.createElement(
                    'button',
                    { className: 'sidebar-link', type: 'button', onClick: onLogout },
                    React.createElement(Icon, { name: 'logout' }),
                    React.createElement('span', null, 'Log Out')
                )
            ),
            React.createElement(
                'button',
                {
                    className: 'sidebar-collapse',
                    type: 'button',
                    onClick: () => setCollapsed((current) => !current),
                    'aria-label': collapsed ? 'Expand sidebar' : 'Collapse sidebar',
                },
                React.createElement(Icon, { name: 'collapse' }),
                React.createElement('span', null, 'collapse')
            )
        );
    }

    window.AppShell = {
        Sidebar,
    };
})();
