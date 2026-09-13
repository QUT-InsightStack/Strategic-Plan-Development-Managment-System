import { TechnicalAdminSidebar } from '../components/TechnicalAdminSidebar.js';
import { AppDialog } from '../components/AppDialog.js';
import { PageHeader } from '../components/PageHeader.js';
import { enforcePageAccess } from '../access/access-guard.js';
import {
    approverOptions,
    demoWorkflow,
} from '../data/workflow-configuration-demo-data.js';

enforcePageAccess();

const { useMemo, useState } = React;
const STORAGE_KEY = 'spdms.workflow-configuration-demo';

function getInitialWorkflow() {
    try {
        const savedWorkflow = JSON.parse(
            localStorage.getItem(STORAGE_KEY)
        );

        if (savedWorkflow?.stages) {
            return savedWorkflow;
        }
    } catch {
        // Use demo workflow when saved data is invalid.
    }

    return structuredClone(demoWorkflow);
}

function WorkflowConfigurationApp() {
    const [workflow, setWorkflow] = useState(getInitialWorkflow);
    const [errors, setErrors] = useState({});
    const [notice, setNotice] = useState(null);
    const [dialog, setDialog] = useState({
        open: false,
    });

    const isActive = workflow.status === 'active';
    const hasStages = workflow.stages.length > 0;

    const stageSummary = useMemo(() => {
        const total = workflow.stages.length;

        return `${total} approval stage${total === 1 ? '' : 's'}`;
    }, [workflow.stages.length]);

    function updateWorkflow(field, value) {
        setWorkflow((current) => ({
            ...current,
            [field]: value,
        }));

        setErrors((current) => ({
            ...current,
            [field]: undefined,
        }));
    }

    function updateStage(stageId, field, value) {
        setWorkflow((current) => ({
            ...current,
            stages: current.stages.map((stage) => {
                if (stage.id !== stageId) {
                    return stage;
                }

                if (field === 'approverType') {
                    return {
                        ...stage,
                        approverType: value,
                        approver: '',
                    };
                }

                return {
                    ...stage,
                    [field]: value,
                };
            }),
        }));

        setErrors((current) => ({
            ...current,
            [`stage-${stageId}-${field}`]: undefined,
        }));
    }

    function addStage() {
        const stageId =
            Math.max(
                0,
                ...workflow.stages.map((stage) => Number(stage.id))
            ) + 1;

        setWorkflow((current) => ({
            ...current,
            status:
                current.status === 'active'
                    ? 'draft'
                    : current.status,
            stages: [
                ...current.stages,
                {
                    id: stageId,
                    name: '',
                    approverType: 'role',
                    approver: '',
                },
            ],
        }));

        setNotice({
            type: 'info',
            message:
                'New stage added. Complete its details before saving.',
        });
    }

    function moveStage(index, direction) {
        const targetIndex = index + direction;

        if (
            targetIndex < 0 ||
            targetIndex >= workflow.stages.length
        ) {
            return;
        }

        setWorkflow((current) => {
            const stages = [...current.stages];

            [stages[index], stages[targetIndex]] = [
                stages[targetIndex],
                stages[index],
            ];

            return {
                ...current,
                status:
                    current.status === 'active'
                        ? 'draft'
                        : current.status,
                stages,
            };
        });
    }

    function requestRemoveStage(stage) {
        setDialog({
            open: true,
            variant: 'danger',
            title: 'Remove approval stage?',
            message:
                `Remove “${stage.name || 'Untitled stage'}” ` +
                'from this workflow? The remaining stages will ' +
                'be resequenced automatically.',
            stageId: stage.id,
        });
    }

    function removeStage() {
        setWorkflow((current) => ({
            ...current,
            status:
                current.status === 'active'
                    ? 'draft'
                    : current.status,
            stages: current.stages.filter(
                (stage) => stage.id !== dialog.stageId
            ),
        }));

        setDialog({ open: false });

        setNotice({
            type: 'success',
            message: 'Approval stage removed.',
        });
    }

    function validateWorkflow() {
        const validationErrors = {};

        if (!workflow.name.trim()) {
            validationErrors.name = 'Enter a workflow name.';
        }

        if (!hasStages) {
            validationErrors.stages =
                'Add at least one approval stage.';
        }

        workflow.stages.forEach((stage) => {
            if (!stage.name.trim()) {
                validationErrors[
                    `stage-${stage.id}-name`
                ] = 'Enter a stage name.';
            }

            if (!stage.approver) {
                validationErrors[
                    `stage-${stage.id}-approver`
                ] = 'Select an approver.';
            }
        });

        setErrors(validationErrors);

        if (Object.keys(validationErrors).length > 0) {
            setNotice({
                type: 'error',
                message:
                    'Review the highlighted fields before continuing.',
            });

            return false;
        }

        return true;
    }

    function saveDraft() {
        if (!validateWorkflow()) {
            return;
        }

        const savedWorkflow = {
            ...workflow,
            status: 'draft',
            updatedAt: new Date().toISOString(),
        };

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(savedWorkflow)
        );

        setWorkflow(savedWorkflow);

        setNotice({
            type: 'success',
            message:
                'Workflow configuration saved as a draft.',
        });
    }

    function requestStatusChange() {
        if (!isActive && !validateWorkflow()) {
            return;
        }

        setDialog({
            open: true,
            variant: isActive ? 'danger' : 'success',
            title: isActive
                ? 'Deactivate workflow?'
                : 'Activate workflow?',
            message: isActive
                ? 'New strategic plan submissions will not use this workflow while it is inactive.'
                : 'New strategic plan submissions will follow these stages from first to final approval.',
            action: 'toggle-status',
        });
    }

    function changeWorkflowStatus() {
        const newStatus = isActive ? 'inactive' : 'active';

        const savedWorkflow = {
            ...workflow,
            status: newStatus,
            updatedAt: new Date().toISOString(),
        };

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(savedWorkflow)
        );

        setWorkflow(savedWorkflow);
        setDialog({ open: false });

        setNotice({
            type: 'success',
            message:
                `Workflow ${
                    newStatus === 'active'
                        ? 'activated'
                        : 'deactivated'
                } successfully.`,
        });
    }

    function renderStage(stage, index) {
        const nameError =
            errors[`stage-${stage.id}-name`];

        const approverError =
            errors[`stage-${stage.id}-approver`];

        return React.createElement(
            'article',
            {
                className: 'workflow-stage',
                key: stage.id,
            },

            React.createElement(
                'div',
                {
                    className: 'workflow-stage__sequence',
                    'aria-label': `Stage ${index + 1}`,
                },
                index + 1
            ),

            React.createElement(
                'div',
                {
                    className: 'workflow-stage__fields',
                },

                React.createElement(
                    'label',
                    {
                        className: nameError
                            ? 'has-error'
                            : '',
                    },

                    React.createElement(
                        'span',
                        null,
                        'Stage name'
                    ),

                    React.createElement('input', {
                        className: 'ui-input',
                        value: stage.name,
                        placeholder: 'e.g. Office Review',
                        onChange: (event) =>
                            updateStage(
                                stage.id,
                                'name',
                                event.target.value
                            ),
                    }),

                    nameError
                        ? React.createElement(
                            'small',
                            {
                                className: 'field-error',
                            },
                            nameError
                        )
                        : null
                ),

                React.createElement(
                    'label',
                    null,

                    React.createElement(
                        'span',
                        null,
                        'Approver type'
                    ),

                    React.createElement(
                        'select',
                        {
                            className: 'ui-select',
                            value: stage.approverType,
                            onChange: (event) =>
                                updateStage(
                                    stage.id,
                                    'approverType',
                                    event.target.value
                                ),
                        },

                        Object.keys(approverOptions).map(
                            (type) =>
                                React.createElement(
                                    'option',
                                    {
                                        key: type,
                                        value: type,
                                    },
                                    type.charAt(0).toUpperCase() +
                                        type.slice(1)
                                )
                        )
                    )
                ),

                React.createElement(
                    'label',
                    {
                        className: approverError
                            ? 'has-error'
                            : '',
                    },

                    React.createElement(
                        'span',
                        null,
                        'Assigned approver'
                    ),

                    React.createElement(
                        'select',
                        {
                            className: 'ui-select',
                            value: stage.approver,
                            onChange: (event) =>
                                updateStage(
                                    stage.id,
                                    'approver',
                                    event.target.value
                                ),
                        },

                        React.createElement(
                            'option',
                            { value: '' },
                            'Select approver'
                        ),

                        approverOptions[
                            stage.approverType
                        ].map((option) =>
                            React.createElement(
                                'option',
                                {
                                    key: option,
                                    value: option,
                                },
                                option
                            )
                        )
                    ),

                    approverError
                        ? React.createElement(
                            'small',
                            {
                                className: 'field-error',
                            },
                            approverError
                        )
                        : null
                )
            ),

            React.createElement(
                'div',
                {
                    className: 'workflow-stage__actions',
                },

                React.createElement(
                    'button',
                    {
                        type: 'button',
                        title: 'Move stage up',
                        'aria-label':
                            `Move stage ${index + 1} up`,
                        disabled: index === 0,
                        onClick: () =>
                            moveStage(index, -1),
                    },
                    React.createElement('i', {
                        className: 'bi bi-arrow-up',
                    })
                ),

                React.createElement(
                    'button',
                    {
                        type: 'button',
                        title: 'Move stage down',
                        'aria-label':
                            `Move stage ${index + 1} down`,
                        disabled:
                            index ===
                            workflow.stages.length - 1,
                        onClick: () =>
                            moveStage(index, 1),
                    },
                    React.createElement('i', {
                        className: 'bi bi-arrow-down',
                    })
                ),

                React.createElement(
                    'button',
                    {
                        className: 'is-danger',
                        type: 'button',
                        title: 'Remove stage',
                        'aria-label':
                            `Remove stage ${index + 1}`,
                        onClick: () =>
                            requestRemoveStage(stage),
                    },
                    React.createElement('i', {
                        className: 'bi bi-trash3',
                    })
                )
            ),

            index < workflow.stages.length - 1
                ? React.createElement(
                    'div',
                    {
                        className:
                            'workflow-stage__connector',
                        'aria-hidden': 'true',
                    },
                    React.createElement('i', {
                        className: 'bi bi-arrow-down',
                    })
                )
                : null
        );
    }

    return React.createElement(
        'div',
        { className: 'app-shell' },

        React.createElement(TechnicalAdminSidebar, {
            onNotice: (message) =>
                setNotice({
                    type: 'info',
                    message,
                }),
        }),

        React.createElement(
            'main',
            {
                className:
                    'app-shell-main workflow-page',
            },

            React.createElement(
                'div',
                {
                    className: 'app-shell-container',
                },

                React.createElement(PageHeader, {
                    section: 'Technical Administration',
                    title:
                        'Approval Workflow Configuration',
                    subtitle:
                        'Define the sequential approval stages used when a strategic plan is submitted for review.',
                }),

                notice
                    ? React.createElement(
                        'div',
                        {
                            className:
                                `ui-status ui-status--${notice.type} workflow-notice`,
                            role: 'status',
                        },
                        notice.message
                    )
                    : null,

                React.createElement(
                    'section',
                    {
                        className:
                            'ui-card workflow-overview',
                        'aria-labelledby':
                            'workflow-details-title',
                    },

                    React.createElement(
                        'div',
                        {
                            className:
                                'workflow-card-header',
                        },

                        React.createElement(
                            'div',
                            null,

                            React.createElement(
                                'h2',
                                {
                                    id:
                                        'workflow-details-title',
                                },
                                'Workflow Details'
                            ),

                            React.createElement(
                                'p',
                                null,
                                'Changes apply to new plan submissions after this workflow is activated.'
                            )
                        ),

                        React.createElement(
                            'span',
                            {
                                className:
                                    `workflow-status workflow-status--${workflow.status}`,
                            },
                            workflow.status
                        )
                    ),

                    React.createElement(
                        'div',
                        {
                            className:
                                'workflow-details-grid',
                        },

                        React.createElement(
                            'label',
                            {
                                className: errors.name
                                    ? 'has-error'
                                    : '',
                            },

                            React.createElement(
                                'span',
                                null,
                                'Workflow name',

                                React.createElement(
                                    'b',
                                    {
                                        'aria-hidden': 'true',
                                    },
                                    ' *'
                                )
                            ),

                            React.createElement('input', {
                                className: 'ui-input',
                                value: workflow.name,
                                placeholder:
                                    'e.g. Strategic Plan Approval',
                                onChange: (event) =>
                                    updateWorkflow(
                                        'name',
                                        event.target.value
                                    ),
                            }),

                            errors.name
                                ? React.createElement(
                                    'small',
                                    {
                                        className:
                                            'field-error',
                                    },
                                    errors.name
                                )
                                : null
                        ),

                        React.createElement(
                            'label',
                            null,

                            React.createElement(
                                'span',
                                null,
                                'Description'
                            ),

                            React.createElement('input', {
                                className: 'ui-input',
                                value:
                                    workflow.description,
                                placeholder:
                                    'Describe when this workflow is used',
                                onChange: (event) =>
                                    updateWorkflow(
                                        'description',
                                        event.target.value
                                    ),
                            })
                        )
                    )
                ),

                React.createElement(
                    'section',
                    {
                        className:
                            'ui-card workflow-builder',
                        'aria-labelledby':
                            'approval-stages-title',
                    },

                    React.createElement(
                        'div',
                        {
                            className:
                                'workflow-card-header',
                        },

                        React.createElement(
                            'div',
                            null,

                            React.createElement(
                                'h2',
                                {
                                    id:
                                        'approval-stages-title',
                                },
                                'Approval Sequence'
                            ),

                            React.createElement(
                                'p',
                                null,
                                `${stageSummary}. Plans progress from the first stage to the final stage.`
                            )
                        ),

                        React.createElement(
                            'button',
                            {
                                className:
                                    'ui-button ui-button--secondary',
                                type: 'button',
                                onClick: addStage,
                            },

                            React.createElement('i', {
                                className:
                                    'bi bi-plus-lg',
                            }),

                            'Add Stage'
                        )
                    ),

                    errors.stages
                        ? React.createElement(
                            'div',
                            {
                                className:
                                    'ui-status ui-status--error workflow-stage-error',
                            },
                            errors.stages
                        )
                        : null,

                    React.createElement(
                        'div',
                        {
                            className:
                                'workflow-stage-list',
                        },

                        workflow.stages.map(
                            renderStage
                        ),

                        !hasStages
                            ? React.createElement(
                                'div',
                                {
                                    className:
                                        'workflow-empty',
                                },

                                React.createElement('i', {
                                    className:
                                        'bi bi-diagram-3',
                                }),

                                React.createElement(
                                    'h3',
                                    null,
                                    'No approval stages'
                                ),

                                React.createElement(
                                    'p',
                                    null,
                                    'Add the first stage to begin defining the approval sequence.'
                                ),

                                React.createElement(
                                    'button',
                                    {
                                        className:
                                            'ui-button ui-button--primary',
                                        type: 'button',
                                        onClick: addStage,
                                    },
                                    'Add First Stage'
                                )
                            )
                            : null
                    )
                ),

                React.createElement(
                    'div',
                    {
                        className:
                            'workflow-page__actions',
                    },

                    React.createElement(
                        'button',
                        {
                            className:
                                'ui-button ui-button--secondary',
                            type: 'button',
                            onClick: saveDraft,
                        },
                        'Save as Draft'
                    ),

                    React.createElement(
                        'button',
                        {
                            className:
                                `ui-button ${
                                    isActive
                                        ? 'ui-button--secondary'
                                        : 'ui-button--primary'
                                }`,
                            type: 'button',
                            onClick:
                                requestStatusChange,
                        },

                        React.createElement('i', {
                            className:
                                `bi ${
                                    isActive
                                        ? 'bi-pause-circle'
                                        : 'bi-check2-circle'
                                }`,
                        }),

                        isActive
                            ? 'Deactivate Workflow'
                            : 'Activate Workflow'
                    )
                )
            )
        ),

        React.createElement(AppDialog, {
            open: dialog.open,
            variant: dialog.variant,
            title: dialog.title,
            message: dialog.message,
            confirmLabel: dialog.stageId
                ? 'Remove Stage'
                : isActive
                    ? 'Deactivate'
                    : 'Activate',
            onConfirm: dialog.stageId
                ? removeStage
                : changeWorkflowStatus,
            onCancel: () =>
                setDialog({ open: false }),
        })
    );
}

ReactDOM.createRoot(
    document.getElementById('root')
).render(
    React.createElement(WorkflowConfigurationApp)
);