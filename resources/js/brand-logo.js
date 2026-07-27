export function BrandLogo({ className = 'brand-logo' } = {}) {
    return React.createElement(
        'span',
        {
            className: `${className} code-logo`,
            role: 'img',
            'aria-label': 'Strategic Planning Management System logo',
        },
        React.createElement('span', { className: 'logo-circle logo-top-left', 'aria-hidden': 'true' }),
        React.createElement('span', { className: 'logo-circle logo-top-right', 'aria-hidden': 'true' }),
        React.createElement('span', { className: 'logo-circle logo-bottom-left', 'aria-hidden': 'true' }),
        React.createElement('span', { className: 'logo-circle logo-bottom-right', 'aria-hidden': 'true' })
    );
}
