export function PageHeader({
    section,
    title,
    subtitle,
    actions = null,
    className = '',
    homeHref = '/dashboard',
}) {
    return React.createElement('header', { className: `app-page-header ${className}`.trim() },
        React.createElement('div', { className: 'app-page-header__copy' },
            React.createElement('nav', { className: 'ui-breadcrumb', 'aria-label': 'Breadcrumb' },
                React.createElement('a', { href: homeHref }, 'Dashboard'),
                React.createElement('i', { className: 'bi bi-chevron-right', 'aria-hidden': 'true' }),
                React.createElement('span', { 'aria-current': 'page' }, section)
            ),
            React.createElement('h1', { className: 'ui-page-title' }, title),
            subtitle ? React.createElement('p', { className: 'ui-page-subtitle' }, subtitle) : null
        ),
        actions ? React.createElement('div', { className: 'app-page-header__actions' }, actions) : null
    );
}
