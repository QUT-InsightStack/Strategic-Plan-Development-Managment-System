import { getAccessSession } from '../../access/access-session.js';

const session = getAccessSession();
function AccessDeniedApp() {
    return React.createElement('main', { className: 'access-denied-page' }, React.createElement('section', { className: 'access-denied-card' }, React.createElement('i', { className: 'bi bi-shield-lock-fill', 'aria-hidden': 'true' }), React.createElement('h1', null, 'Access Denied'), React.createElement('p', null, 'Your assigned role does not have permission to view this content.'), React.createElement('a', { className: 'ui-button ui-button--primary', href: session?.home || '/login' }, 'Go to My Home Page')));
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AccessDeniedApp));
