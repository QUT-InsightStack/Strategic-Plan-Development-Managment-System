import { TechnicalAdminSidebar } from '../../components/TechnicalAdminSidebar.js';
import { AppDialog } from '../../components/AppDialog.js';
import { PageHeader } from '../../components/PageHeader.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { apiRequest } from '../../api/api-client.js';

enforcePageAccess();
const { useEffect, useMemo, useState } = React;
const blankWorkflow = { name: 'Strategic Plan Approval', description: '', status: 'draft', version: 0, stages: [] };
function fromServer(data) {
    return { ...data, stages: data.stages.map(stage => ({ ...stage,
        approverType: stage.user_id ? 'user' : 'role', approver: String(stage.user_id || stage.role_id),
    })) };
}
function WorkflowConfigurationApp() {
    const [workflow, setWorkflow] = useState(blankWorkflow);
    const [errors, setErrors] = useState({});
    const [notice, setNotice] = useState(null);
    const [dialog, setDialog] = useState({
        open: false,
    });

    const [approverOptions, setApproverOptions] = useState({ role: [], user: [] });
    const [busy, setBusy] = useState(true);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        apiRequest('/api/approval-workflow').then(payload => {
            setWorkflow(fromServer(payload.data));
            setApproverOptions({
                role: payload.options.roles.map(role => ({ id: String(role.role_id), label: role.role_name })),
                user: payload.options.users.map(user => ({ id: String(user.user_id), label: [user.first_name, user.last_name].filter(Boolean).join(' ') })),
            });
            setLoaded(true);
        }).catch(error => setNotice({ type: 'error', message: error.message })).finally(() => setBusy(false));
    }, []);

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

    async function persist(status) {
        if (busy || !loaded || !validateWorkflow()) return;
        setBusy(true);
        try {
            const response = await apiRequest('/api/approval-workflow', {
                method: 'PUT', body: JSON.stringify({
                    name: workflow.name, description: workflow.description, version: workflow.version, status,
                    stages: workflow.stages.map((stage, index) => ({
                        name: stage.name, sequence: index + 1,
                        user_id: stage.approverType === 'user' ? Number(stage.approver) : null,
                        role_id: stage.approverType === 'role' ? Number(stage.approver) : null,
                    })),
                }),
            });
            setWorkflow(fromServer(response.data));
            setNotice({ type: 'success', message: `Workflow saved (${status}).` });
        } catch (error) {
            setNotice({ type: 'error', message: Object.values(error.errors || {}).flat().join(' ') || error.message });
        } finally { setBusy(false); setDialog({ open: false }); }
    }

    function saveDraft() { return persist('draft'); }

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

    function changeWorkflowStatus() { return persist(isActive ? 'inactive' : 'active'); }

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
                                    key: option.id,
                                    value: option.id,
                                },
                                option.label
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
                            disabled: busy || !loaded,
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
                            disabled: busy || !loaded,
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
