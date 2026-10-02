import { mountProtectedPage } from '../../access/mount-protected-page.js';
import { TechnicalAdminSidebar } from '../../components/TechnicalAdminSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { SecuritySettings } from '../../components/SecuritySettings.js';

mountProtectedPage(document.getElementById('root'), () => {
    const SettingsApp = () => React.createElement(React.Fragment, null,
        React.createElement(TechnicalAdminSidebar, { active: 'Settings' }),
        React.createElement('main', { className: 'app-shell-main settings-page' },
            React.createElement('div', { className: 'app-shell-container' },
                React.createElement(PageHeader, {
                    section: 'Technical Administration',
                    title: 'System Settings',
                    subtitle: 'Configure authentication and session protection applied across the system.',
                }),
                React.createElement(SecuritySettings)
            )
        )
    );

    return React.createElement(SettingsApp);
});
