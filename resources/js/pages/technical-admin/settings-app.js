import { mountProtectedPage } from '../../access/mount-protected-page.js';
import { TechnicalAdminSidebar } from '../../components/TechnicalAdminSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { SecuritySettings } from '../../components/SecuritySettings.js';

mountProtectedPage(document.getElementById('root'), () => {
    const SettingsApp = () => React.createElement(React.Fragment, null,
        React.createElement(TechnicalAdminSidebar, { active: 'Security Settings' }),
        React.createElement('main', { className: 'app-shell-main settings-page' },
            React.createElement('div', { className: 'app-shell-container' },
                React.createElement(PageHeader, {
                    section: 'Account Security',
                    title: 'Security Settings',
                    subtitle: 'Set session, sign-in, password and maintenance rules for SPDMS.',
                }),
                React.createElement(SecuritySettings)
            )
        )
    );

    return React.createElement(SettingsApp);
});
