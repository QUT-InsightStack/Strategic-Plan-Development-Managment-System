import { createPageRoot } from '../../navigation/page-root.js';
import { AppSidebar } from '../../components/AppSidebar.js';
import { ObjectiveProgressPanel } from '../../strategic-objectives/ObjectiveProgressPanel.js';
import { enforcePageAccess } from '../../access/access-guard.js';

enforcePageAccess();

function ProgressMonitoringApp() {
    return React.createElement(
        React.Fragment,
        null,
        React.createElement(AppSidebar, { active: 'Monitor Module' }),
        React.createElement(
            'main',
            { className: 'app-shell-main progress-monitoring-page' },
            React.createElement(
                'div',
                { className: 'app-shell-container' },
                React.createElement(
                    'header',
                    null,
                    React.createElement('h1', null, 'Strategic Objective Progress Monitoring'),
                    React.createElement('p', null, 'View and correct progress across all assigned Offices and Units. Every Planning Officer change requires a reason and is recorded in the progress history.')
                ),
                React.createElement(ObjectiveProgressPanel)
            )
        )
    );
}

createPageRoot(document.getElementById('root')).render(
    React.createElement(ProgressMonitoringApp)
);
