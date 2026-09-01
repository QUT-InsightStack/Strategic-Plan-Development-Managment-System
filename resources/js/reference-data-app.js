import { enforcePageAccess } from './access/access-guard.js';
import { AdministrativeItemFormApp } from './pages/administrative-item-form-app.js';
import { ReferenceDataManagementApp } from './pages/reference-data-management-app.js';
import { TemplateManagementApp } from './pages/template-management-app.js';

if (enforcePageAccess()) {
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

    ReactDOM.createRoot(rootElement).render(React.createElement(PageComponent, pageProps));
}
