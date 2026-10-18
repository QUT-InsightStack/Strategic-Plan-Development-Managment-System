import { mountProtectedPage } from '../../access/mount-protected-page.js';
import { AdministrativeItemFormApp } from './administrative-item-form-app.js';
import { ReferenceDataManagementApp } from './reference-data-management-app.js';
import { TemplateManagementApp } from './template-management-app.js';

mountProtectedPage(document.getElementById('root'), () => {
    const rootElement = document.getElementById('root');
    const pathname = window.location.pathname;
    let PageComponent = ReferenceDataManagementApp;
    let pageProps = {};

    if (/^\/administrative-admin\/reference-data\/agenda\/(?:create|[^/]+\/edit)$/.test(pathname)) {
        PageComponent = AdministrativeItemFormApp;
        pageProps = { itemType: 'agenda' };
    }
    else if (/^\/administrative-admin\/templates\/(?:create|[^/]+\/edit)$/.test(pathname)) {
        PageComponent = AdministrativeItemFormApp;
        pageProps = { itemType: 'template' };
    }
    else if (pathname === '/administrative-admin/templates') {
        PageComponent = TemplateManagementApp;
    }

    return React.createElement(PageComponent, pageProps);
});
