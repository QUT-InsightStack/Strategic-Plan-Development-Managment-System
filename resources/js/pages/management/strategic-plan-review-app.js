import { AppSidebar } from '../../components/AppSidebar.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { getAccessSession } from '../../access/access-session.js';
import {
    getPlanSubmission,
    isSubmissionAssignedToReviewer,
    processPlanDecision,
} from '../../api/plan-approval-api.js';

enforcePageAccess();

const h = React.createElement;
const { useEffect, useState } = React;

const root = document.getElementById('root');
const planId = Number(root.dataset.planId);

function text(value) {
    return String(value || '').trim();
}

function formatDateTime(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function creatorName(creator) {
    if (!creator) {
        return '—';
    }

    return (
        [creator.first_name, creator.last_name]
            .filter(Boolean)
            .join(' ') ||
        creator.email ||
        '—'
    );
}

function coreValueLabel(value) {
    return (
        value?.content ||
        value?.title ||
        value?.name ||
        value?.core_value ||
        String(value || '')
    );
}

function responsibleUnitName(objective) {
    return (
        objective?.responsible_unit_assignment
            ?.responsible_unit?.name ||
        objective?.responsible_unit_assignment
            ?.responsible_unit?.unit_name ||
        objective?.responsible_office_agency ||
        'Not assigned'
    );
}

function chapterLabel(chapter) {
    const number =
        chapter?.chapter_number ||
        chapter?.number ||
        chapter?.chapter_id;

    const title =
        chapter?.chapter_title ||
        chapter?.title ||
        chapter?.description;

    return [number ? `Chapter ${number}` : '', title]
        .filter(Boolean)
        .join(': ') || 'PDP Chapter';
}

function agendaLabel(item) {
    return (
        item?.agenda_title ||
        item?.title ||
        item?.description ||
        item?.agenda_name ||
        `Agenda item ${item?.agenda_id || ''}`.trim()
    );
}

function Accordion({
    id,
    title,
    count = null,
    open,
    onToggle,
    children,
}) {
    return h(
        'section',
        {
            className: 'plan-review-accordion',
        },

        h(
            'button',
            {
                className:
                    'plan-review-accordion__toggle',
                type: 'button',
                onClick: onToggle,
                'aria-expanded': open,
                'aria-controls': id,
            },

            h(
                'span',
                null,
                count === null
                    ? title
                    : `${title} (${count})`
            ),

            h('i', {
                className:
                    `bi bi-chevron-${open ? 'up' : 'down'}`,
                'aria-hidden': 'true',
            })
        ),

        open
            ? h(
                'div',
                {
                    className:
                        'plan-review-accordion__body',
                    id,
                },
                children
            )
            : null
    );
}

function DecisionDialog({
    dialog,
    processing,
    error,
    onCommentChange,
    onCancel,
    onConfirm,
}) {
    if (!dialog.open) {
        return null;
    }

    const rejecting =
        dialog.decision === 'reject';

    const title = rejecting
        ? 'Return Strategic Plan for correction?'
        : 'Approve Strategic Plan?';

    const description = rejecting
        ? 'Add a comment explaining the corrections needed. The current approval cycle will end and the plan can be resubmitted.'
        : 'Confirm that you have reviewed the Strategic Plan and want to approve it at the current workflow stage.';

    return h(
        'div',
        {
            className:
                'ui-dialog-backdrop',
            role: 'presentation',
        },

        h(
            'section',
            {
                className:
                    `ui-dialog plan-decision-dialog ` +
                    `${rejecting ? 'ui-dialog--error' : ''}`,
                role: 'dialog',
                'aria-modal': 'true',
                'aria-labelledby':
                    'plan-decision-dialog-title',
                'aria-describedby':
                    'plan-decision-dialog-description',
            },

            h(
                'div',
                {
                    className:
                        'ui-dialog__icon',
                    'aria-hidden': 'true',
                },
                h('i', {
                    className:
                        rejecting
                            ? 'bi bi-x-lg'
                            : 'bi bi-check-lg',
                })
            ),

            h(
                'h2',
                {
                    id:
                        'plan-decision-dialog-title',
                },
                title
            ),

            h(
                'p',
                {
                    id:
                        'plan-decision-dialog-description',
                },
                description
            ),

            h(
                'label',
                {
                    className:
                        'ui-field plan-decision-comment',
                },

                h(
                    'span',
                    {
                        className: 'ui-label',
                    },
                    rejecting
                        ? 'Correction comment *'
                        : 'Approval comment (optional)'
                ),

                h('textarea', {
                    className: 'ui-textarea',
                    rows: 5,
                    maxLength: 2000,
                    required: rejecting,
                    disabled: processing,
                    value: dialog.comment,
                    placeholder: rejecting
                        ? 'Explain what must be corrected before resubmission'
                        : 'Add an optional comment about this approval',
                    onChange: (event) =>
                        onCommentChange(
                            event.target.value
                        ),
                }),

                h(
                    'small',
                    {
                        className:
                            'plan-decision-character-count',
                    },
                    `${dialog.comment.length}/2000`
                )
            ),

            error
                ? h(
                    'div',
                    {
                        className:
                            'ui-status ui-status--error plan-decision-error',
                        role: 'alert',
                    },
                    error
                )
                : null,

            h(
                'div',
                {
                    className:
                        'ui-dialog__actions plan-decision-dialog-actions',
                },

                h(
                    'button',
                    {
                        className:
                            'ui-button ui-button--secondary',
                        type: 'button',
                        disabled: processing,
                        onClick: onCancel,
                    },
                    'Cancel'
                ),

                h(
                    'button',
                    {
                        className:
                            rejecting
                                ? 'ui-button ui-button--danger-solid'
                                : 'ui-button ui-button--primary',
                        type: 'button',
                        disabled:
                            processing ||
                            (
                                rejecting &&
                                !dialog.comment.trim()
                            ),
                        onClick: onConfirm,
                    },
                    processing
                        ? 'Processing…'
                        : rejecting
                            ? 'Return for correction'
                            : 'Confirm Approval'
                )
            )
        )
    );
}

function StrategicPlanReviewApp() {
    const session = getAccessSession();

    const [plan, setPlan] = useState(null);
    const [submission, setSubmission] = useState(null);
    const [objectives, setObjectives] = useState([]);
    const [coreValues, setCoreValues] = useState([]);
    const [commentsByObjective, setCommentsByObjective] =
        useState({});
    const [loading, setLoading] = useState(true);
    const [processingDecision, setProcessingDecision] =
    useState(false);

const [decisionProcessed, setDecisionProcessed] =
    useState(false);

const [decisionError, setDecisionError] =
    useState('');

const [decisionDialog, setDecisionDialog] =
    useState({
        open: false,
        decision: '',
        comment: '',
    });
    const [accessDenied, setAccessDenied] = useState(false);
    const [notice, setNotice] = useState({
        type: '',
        message: '',
    });
    const [openSections, setOpenSections] = useState({
        foundation: true,
        objectives: true,
        documents: false,
        workflow: true,
        history: false,
    });

    useEffect(() => {
        let active = true;

        async function loadReview() {
            if (!Number.isInteger(planId) || planId <= 0) {
                setNotice({
                    type: 'error',
                    message:
                        'A valid Strategic Plan ID was not provided.',
                });
                setLoading(false);
                return;
            }

            try {
                const storedSubmission = await getPlanSubmission(planId);
                if (!active) return;
                const snapshot = storedSubmission.plan_snapshot;
                setSubmission(storedSubmission);
                setPlan(snapshot);
                setObjectives(snapshot.objectives || []);
                setCoreValues(snapshot.core_values || []);
                setCommentsByObjective(Object.fromEntries((snapshot.objectives || []).map(objective => [objective.objective_id, { comments: objective.comments || [], error: '' }])));
            } catch (error) {
                if (!active) {
                    return;
                }

                setAccessDenied(error.status === 403);
                setNotice({
                    type: 'error',
                    message:
                        error.message ||
                        'The submitted Strategic Plan could not be loaded.',
                });
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadReview();

        return () => {
            active = false;
        };
    }, []);

    function toggleSection(section) {
        setOpenSections((current) => ({
            ...current,
            [section]: !current[section],
        }));
    }
    function openDecisionDialog(decision) {
    if (
        !isSubmissionAssignedToReviewer(submission, session) ||
        processingDecision ||
        decisionProcessed ||
        submission?.status !==
            'under_approval'
    ) {
        return;
    }

    setDecisionError('');

    setDecisionDialog({
        open: true,
        decision,
        comment: '',
    });
}

function closeDecisionDialog() {
    if (processingDecision) {
        return;
    }

    setDecisionError('');

    setDecisionDialog({
        open: false,
        decision: '',
        comment: '',
    });
}

function updateDecisionComment(comment) {
    setDecisionError('');

    setDecisionDialog((current) => ({
        ...current,
        comment,
    }));
}

async function confirmDecision() {
    if (
        !decisionDialog.open ||
        processingDecision
    ) {
        return;
    }

    const decision =
        decisionDialog.decision;

    const comment =
        decisionDialog.comment.trim();

    if (
        decision === 'reject' &&
        !comment
    ) {
        setDecisionError(
            'Enter a correction comment before returning the Strategic Plan.'
        );
        return;
    }

    setProcessingDecision(true);
    setDecisionError('');

    try {
        const updatedSubmission =
            await processPlanDecision({
                planId,
                decision,
                comment,
                submission,
            });

        setSubmission(updatedSubmission);
        setDecisionProcessed(true);

        setDecisionDialog({
            open: false,
            decision: '',
            comment: '',
        });

        if (decision === 'reject') {
            setNotice({
                type: 'success',
                message:
                    'The Strategic Plan was returned for correction. The current approval cycle has ended and your comment was recorded.',
            });

            return;
        }

        if (
            updatedSubmission.status ===
            'approved'
        ) {
            setNotice({
                type: 'success',
                message:
                    'The Strategic Plan received final approval. The decision was recorded in the workflow history.',
            });

            return;
        }

        setNotice({
            type: 'success',
            message:
                `The Strategic Plan was approved at this stage and advanced to “${updatedSubmission.currentStage.name}”, assigned to ${updatedSubmission.currentStage.approver}.`,
        });
    } catch (error) {
        setDecisionError(
            error.message ||
            'The approval decision could not be processed.'
        );
    } finally {
        setProcessingDecision(false);
    }
}

    const mission =
        plan?.missionFoundation ||
        plan?.mission_foundation;

    const vision =
        plan?.visionFoundation ||
        plan?.vision_foundation;

    const workflowStages =
        submission?.workflowSnapshot?.stages || [];

    const history = submission?.history || [];

    const documents = [...(plan?.documents || []), ...objectives.flatMap(objective => objective.documents || [])];

    function renderEmpty(message) {
        return h(
            'p',
            {
                className: 'plan-review-empty-text',
            },
            message
        );
    }

    function renderObjective(objective, index) {
        const chapters =
            objective.pdp_chapters || [];

        const agendaItems =
            objective.presidential_agenda_items || [];

        const commentResult =
            commentsByObjective[
                objective.objective_id
            ] || {
                comments: [],
                error: '',
            };

        return h(
            'article',
            {
                className: 'plan-review-objective',
                key: objective.objective_id,
            },

            h(
                'header',
                {
                    className:
                        'plan-review-objective__header',
                },

                h(
                    'div',
                    {
                        className:
                            'plan-review-objective__number',
                    },
                    index + 1
                ),

                h(
                    'div',
                    null,
                    h(
                        'h3',
                        null,
                        objective.objective_title ||
                            `Objective ${index + 1}`
                    ),
                    h(
                        'span',
                        {
                            className:
                                `ui-badge ui-badge--${objective.status || 'draft'}`,
                        },
                        text(objective.status)
                            .replaceAll('_', ' ')
                            .replace(/^./, (letter) =>
                                letter.toUpperCase()
                            ) || 'Draft'
                    )
                )
            ),

            h(
                'div',
                {
                    className:
                        'plan-review-objective__body',
                },

                h(
                    'div',
                    {
                        className:
                            'plan-review-objective-description',
                    },
                    h('h4', null, 'Description'),
                    h(
                        'p',
                        null,
                        objective.objective_description ||
                            'No description provided.'
                    )
                ),

                h(
                    'div',
                    {
                        className:
                            'plan-review-objective-grid',
                    },

                    [
                        [
                            'Expected Outcome',
                            objective.expected_outcome,
                        ],
                        [
                            'Indicator',
                            objective.indicator,
                        ],
                        [
                            'Target',
                            objective.target,
                        ],
                        [
                            'Responsible Office / Unit',
                            responsibleUnitName(
                                objective
                            ),
                        ],
                    ].map(([label, value]) =>
                        h(
                            'div',
                            {
                                className:
                                    'plan-review-detail-item',
                                key: label,
                            },
                            h('small', null, label),
                            h(
                                'strong',
                                null,
                                value || 'Not provided'
                            )
                        )
                    )
                ),

                h(
                    'section',
                    {
                        className:
                            'plan-review-objective-section',
                    },
                    h(
                        'h4',
                        null,
                        'PDP Chapter Mapping'
                    ),

                    chapters.length
                        ? h(
                            'ul',
                            {
                                className:
                                    'plan-review-tag-list',
                            },
                            chapters.map((chapter) =>
                                h(
                                    'li',
                                    {
                                        key:
                                            chapter.chapter_id ||
                                            chapterLabel(
                                                chapter
                                            ),
                                    },
                                    chapterLabel(chapter)
                                )
                            )
                        )
                        : renderEmpty(
                            'No PDP Chapter mapping is recorded.'
                        )
                ),

                h(
                    'section',
                    {
                        className:
                            'plan-review-objective-section',
                    },
                    h(
                        'h4',
                        null,
                        'Presidential Agenda Mapping'
                    ),

                    agendaItems.length
                        ? h(
                            'ul',
                            {
                                className:
                                    'plan-review-tag-list',
                            },
                            agendaItems.map((item) =>
                                h(
                                    'li',
                                    {
                                        key:
                                            item.agenda_id ||
                                            agendaLabel(item),
                                    },
                                    agendaLabel(item)
                                )
                            )
                        )
                        : renderEmpty(
                            'No Presidential Agenda mapping is recorded.'
                        )
                ),

                h(
                    'section',
                    {
                        className:
                            'plan-review-objective-section',
                    },

                    h(
                        'h4',
                        null,
                        `Comments (${commentResult.comments.length})`
                    ),

                    commentResult.error
                        ? h(
                            'p',
                            {
                                className:
                                    'plan-review-inline-error',
                                role: 'alert',
                            },
                            commentResult.error
                        )
                        : commentResult.comments.length
                            ? h(
                                'ul',
                                {
                                    className:
                                        'plan-review-comment-list',
                                },
                                commentResult.comments.map(
                                    (comment) =>
                                        h(
                                            'li',
                                            {
                                                key:
                                                    comment.comment_id,
                                            },
                                            h(
                                                'p',
                                                null,
                                                comment.content ||
                                                    comment.comment ||
                                                    'No comment text.'
                                            ),
                                            h(
                                                'small',
                                                null,
                                                [
                                                    comment.submitter_name || creatorName(
                                                        comment.submitter ||
                                                        comment.submitted_by_user ||
                                                        comment.creator
                                                    ),
                                                    formatDateTime(
                                                        comment.submitted_at ||
                                                        comment.created_at
                                                    ),
                                                ]
                                                    .filter(
                                                        (value) =>
                                                            value !==
                                                            '—'
                                                    )
                                                    .join(' · ')
                                            )
                                        )
                                )
                            )
                            : renderEmpty(
                                'No comments have been submitted for this objective.'
                            )
                )
            )
        );
    }

    if (accessDenied) {
        return h(
            React.Fragment,
            null,

            h(AppSidebar),

            h(
                'main',
                {
                    className:
                        'app-shell-main plan-reviews-page',
                },

                h(
                    'div',
                    {
                        className:
                            'app-shell-container plan-review-container',
                    },

                    h(
                        'section',
                        {
                            className:
                                'ui-card plan-review-access-denied',
                            role: 'alert',
                        },

                        h('i', {
                            className:
                                'bi bi-shield-lock-fill',
                            'aria-hidden': 'true',
                        }),

                        h(
                            'h1',
                            null,
                            'Review access unavailable'
                        ),

                        h(
                            'p',
                            null,
                            'This Strategic Plan is not assigned to you at the current workflow stage.'
                        ),

                        h(
                            'a',
                            {
                                className:
                                    'ui-button ui-button--primary',
                                href:
                                    '/strategic-plan-reviews',
                            },
                            'Return to Assigned Reviews'
                        )
                    )
                )
            )
        );
    }

    return h(
        React.Fragment,
        null,

        h(AppSidebar, {
    onNotice: (message) =>
        setNotice({
            type: 'info',
            message,
        }),
}),

h(DecisionDialog, {
    dialog: decisionDialog,
    processing: processingDecision,
    error: decisionError,
    onCommentChange:
        updateDecisionComment,
    onCancel: closeDecisionDialog,
    onConfirm: confirmDecision,
}),

h(
    'main',
            {
                className:
                    'app-shell-main plan-reviews-page',
            },

            h(
                'div',
                {
                    className:
                        'app-shell-container plan-review-container',
                },

                h(
                    'nav',
                    {
                        className:
                            'plan-review-breadcrumb',
                        'aria-label': 'Breadcrumb',
                    },

                    h(
                        'a',
                        {
                            href:
                                '/strategic-plan-reviews',
                        },
                        'Assigned Plan Reviews'
                    ),

                    h('i', {
                        className:
                            'bi bi-chevron-right',
                        'aria-hidden': 'true',
                    }),

                    h(
                        'span',
                        null,
                        'Review Submitted Plan'
                    )
                ),

                h(
                    'div',
                    {
                        className:
                            'plan-review-page-heading',
                    },

                    h(
                        'div',
                        null,
                        h(
                            'span',
                            {
                                className:
                                    'plan-review-eyebrow',
                            },
                            'Strategic Planning'
                        ),
                        h(
                            'h1',
                            null,
                            'Review Submitted Strategic Plan'
                        ),
                        h(
                            'p',
                            null,
                            'Review the submitted plan and its supporting information for the current workflow stage.'
                        )
                    ),

                    h(
                        'a',
                        {
                            className:
                                'ui-button ui-button--secondary',
                            href:
                                '/strategic-plan-reviews',
                        },
                        h('i', {
                            className:
                                'bi bi-arrow-left',
                            'aria-hidden': 'true',
                        }),
                        'Back to Reviews'
                    )
                ),

                h('a', { className: 'ui-button ui-button--secondary', href: `/strategic-plans/${planId}/approval-status` }, 'Approval status and history'),
                notice.message
                    ? h(
                        'div',
                        {
                            className:
                                `ui-status ui-status--${notice.type} ` +
                                'plan-review-feedback',
                            role:
                                notice.type === 'error'
                                    ? 'alert'
                                    : 'status',
                        },
                        notice.message
                    )
                    : null,

                loading
                    ? h(
                        'section',
                        {
                            className:
                                'ui-card ui-empty',
                            role: 'status',
                        },
                        'Loading submitted Strategic Plan…'
                    )
                    : !plan
                        ? h(
                            'section',
                            {
                                className:
                                    'ui-card plan-review-empty',
                            },
                            h('i', {
                                className:
                                    'bi bi-file-earmark-x',
                                'aria-hidden': 'true',
                            }),
                            h(
                                'h2',
                                null,
                                'Strategic Plan unavailable'
                            ),
                            h(
                                'p',
                                null,
                                'The requested submitted plan could not be displayed.'
                            )
                        )
                        : h(
                            'div',
                            {
                                className:
                                    'plan-review-detail-layout',
                            },

                            h(
                                'div',
                                {
                                    className:
                                        'plan-review-main-column',
                                },

                                h(
                                    'section',
                                    {
                                        className:
                                            'ui-card plan-review-summary',
                                        'aria-labelledby':
                                            'plan-summary-title',
                                    },

                                    h(
                                        'div',
                                        {
                                            className:
                                                'plan-review-section-heading',
                                        },
                                        h(
                                            'div',
                                            null,
                                            h(
                                                'h2',
                                                {
                                                    id:
                                                        'plan-summary-title',
                                                },
                                                'Plan Information'
                                            ),
                                            h(
                                                'p',
                                                null,
                                                plan.title
                                            )
                                        ),
                                        h(
                                            'span',
                                            {
                                                className:
                                                    'ui-badge plan-review-status',
                                            },
                                            'Under Approval'
                                        )
                                    ),

                                    h(
                                        'div',
                                        {
                                            className:
                                                'plan-review-summary-grid',
                                        },

                                        [
                                            [
                                                'Plan ID',
                                                String(
                                                    plan.record_id
                                                ).padStart(
                                                    4,
                                                    '0'
                                                ),
                                            ],
                                            [
                                                'Plan Title',
                                                plan.title,
                                            ],
                                            [
                                                'Plan Level',
                                                text(
                                                    plan.level ||
                                                    'strategic_plan'
                                                ).replaceAll(
                                                    '_',
                                                    ' '
                                                ),
                                            ],
                                            [
                                                'Submitted By',
                                                submission?.submittedBy,
                                            ],
                                            [
                                                'Department / Agency',
                                                plan.creator
                                                    ?.department ||
                                                plan.creator
                                                    ?.office ||
                                                '—',
                                            ],
                                            [
                                                'Submitted',
                                                formatDateTime(
                                                    submission
                                                        ?.submittedAt
                                                ),
                                            ],
                                        ].map(
                                            ([label, value]) =>
                                                h(
                                                    'div',
                                                    {
                                                        className:
                                                            'plan-review-detail-item',
                                                        key: label,
                                                    },
                                                    h(
                                                        'small',
                                                        null,
                                                        label
                                                    ),
                                                    h(
                                                        'strong',
                                                        null,
                                                        value ||
                                                        '—'
                                                    )
                                                )
                                        )
                                    ),

                                    plan.description
                                        ? h(
                                            'div',
                                            {
                                                className:
                                                    'plan-review-description',
                                            },
                                            h(
                                                'h3',
                                                null,
                                                'Description / Notes'
                                            ),
                                            h(
                                                'p',
                                                null,
                                                plan.description
                                            )
                                        )
                                        : null
                                ),

                                h(
                                    'div',
                                    {
                                        className:
                                            'plan-review-accordions',
                                    },

                                    h(
                                        Accordion,
                                        {
                                            id:
                                                'review-foundation',
                                            title:
                                                'Strategic Foundation',
                                            open:
                                                openSections.foundation,
                                            onToggle: () =>
                                                toggleSection(
                                                    'foundation'
                                                ),
                                        },

                                        h(
                                            'div',
                                            {
                                                className:
                                                    'plan-review-foundation-grid',
                                            },

                                            h(
                                                'article',
                                                null,
                                                h(
                                                    'h3',
                                                    null,
                                                    'Mission'
                                                ),
                                                h(
                                                    'p',
                                                    null,
                                                    mission?.content ||
                                                    'No mission has been provided.'
                                                )
                                            ),

                                            h(
                                                'article',
                                                null,
                                                h(
                                                    'h3',
                                                    null,
                                                    'Vision'
                                                ),
                                                h(
                                                    'p',
                                                    null,
                                                    vision?.content ||
                                                    'No vision has been provided.'
                                                )
                                            ),

                                            h(
                                                'article',
                                                null,
                                                h(
                                                    'h3',
                                                    null,
                                                    'Core Values'
                                                ),

                                                coreValues.length
                                                    ? h(
                                                        'ul',
                                                        {
                                                            className:
                                                                'plan-review-tag-list',
                                                        },
                                                        coreValues.map(
                                                            (
                                                                value,
                                                                index
                                                            ) =>
                                                                h(
                                                                    'li',
                                                                    {
                                                                        key:
                                                                            value
                                                                                .core_value_id ||
                                                                            value
                                                                                .foundation_id ||
                                                                            index,
                                                                    },
                                                                    coreValueLabel(
                                                                        value
                                                                    )
                                                                )
                                                        )
                                                    )
                                                    : renderEmpty(
                                                        'No core values have been provided.'
                                                    )
                                            )
                                        )
                                    ),

                                    h(
                                        Accordion,
                                        {
                                            id:
                                                'review-objectives',
                                            title:
                                                'Strategic Objectives',
                                            count:
                                                objectives.length,
                                            open:
                                                openSections.objectives,
                                            onToggle: () =>
                                                toggleSection(
                                                    'objectives'
                                                ),
                                        },

                                        objectives.length
                                            ? h(
                                                'div',
                                                {
                                                    className:
                                                        'plan-review-objective-list',
                                                },
                                                objectives.map(
                                                    renderObjective
                                                )
                                            )
                                            : renderEmpty(
                                                'No Strategic Objectives are available.'
                                            )
                                    ),

                                    h(
                                        Accordion,
                                        {
                                            id:
                                                'review-documents',
                                            title:
                                                'Supporting Documents',
                                            count: documents.length,
                                            open:
                                                openSections.documents,
                                            onToggle: () =>
                                                toggleSection(
                                                    'documents'
                                                ),
                                        },

                                        (plan?.inputs || []).map(input => h('p', { key: `input-${input.input_id}` },
                                            `${input.submitter_name}: ${input.content} (${input.review_status})`)),
                                        documents.length
                                            ? h('ul', { className: 'plan-review-document-list' }, documents.map(document =>
                                                h('li', { key: document.document_id }, h('a', {
                                                    href: `/api/plan-submissions/${submission.id}/documents/${document.document_id}`,
                                                }, document.original_filename))))
                                            : renderEmpty('No supporting documents are attached to this submission.')
                                    )
                                )
                            ),

                            h(
                                'aside',
                                {
                                    className:
                                        'plan-review-side-column',
                                },

                                h(
                                    'section',
                                    {
                                        className:
                                            'ui-card plan-review-current-stage',
                                        'aria-labelledby':
                                            'current-stage-title',
                                    },

                                    h(
                                        'div',
                                        {
                                            className:
                                                'plan-review-section-heading',
                                        },
                                        h(
                                            'div',
                                            null,
                                            h(
                                                'h2',
                                                {
                                                    id:
                                                        'current-stage-title',
                                                },
                                                'Current Review Stage'
                                            ),
                                            h(
                                                'p',
                                                null,
                                                submission
                                                    ?.workflowName ||
                                                'Approval workflow'
                                            )
                                        )
                                    ),

                                    h(
                                        'div',
                                        {
                                            className:
                                                'plan-review-current-stage__body',
                                        },

                                        h(
                                            'span',
                                            {
                                                className:
                                                    'plan-review-stage-number',
                                            },
                                            submission
                                                ?.currentStage
                                                ?.sequence
                                                ? `Stage ${submission.currentStage.sequence}`
                                                : 'Current stage'
                                        ),

                                        h(
                                            'h3',
                                            null,
                                            submission
                                                ?.currentStage
                                                ?.name ||
                                            'Review stage'
                                        ),

                                        h(
                                            'dl',
                                            null,

                                            h(
                                                'div',
                                                null,
                                                h(
                                                    'dt',
                                                    null,
                                                    'Assigned to'
                                                ),
                                                h(
                                                    'dd',
                                                    null,
                                                    submission
                                                        ?.currentStage
                                                        ?.approver ||
                                                    '—'
                                                )
                                            ),

                                            h(
                                                'div',
                                                null,
                                                h(
                                                    'dt',
                                                    null,
                                                    'Assignment type'
                                                ),
                                                h(
                                                    'dd',
                                                    null,
                                                    text(
                                                        submission
                                                            ?.currentStage
                                                            ?.approverType
                                                    )
                                                        .replaceAll(
                                                            '_',
                                                            ' '
                                                        )
                                                        .replace(
                                                            /^./,
                                                            (
                                                                letter
                                                            ) =>
                                                                letter.toUpperCase()
                                                        ) ||
                                                    '—'
                                                )
                                            ),

                                            h(
                                                'div',
                                                null,
                                                h(
                                                    'dt',
                                                    null,
                                                    'Status'
                                                ),
                                                h(
                                                    'dd',
                                                    null,
                                                    'Pending Review'
                                                )
                                            )
                                        )
                                    )
                                ),

                                h(
    'section',
    {
        className:
            'ui-card plan-review-decision-card',
        'aria-labelledby':
            'plan-decision-title',
    },

    h(
        'div',
        {
            className:
                'plan-review-section-heading',
        },

        h(
            'div',
            null,
            h(
                'h2',
                {
                    id:
                        'plan-decision-title',
                },
                'Review Decision'
            ),
            h(
                'p',
                null,
                'Record your decision for the current workflow stage.'
            )
        )
    ),

    h(
        'div',
        {
            className:
                'plan-review-decision-body',
        },

        decisionProcessed ||
        submission?.status !==
            'under_approval'
            ? h(
                'div',
                {
                    className:
                        'plan-review-decision-complete',
                    role: 'status',
                },

                h('i', {
                    className:
                        submission?.status ===
                        'rejected'
                            ? 'bi bi-x-circle-fill'
                            : 'bi bi-check-circle-fill',
                    'aria-hidden': 'true',
                }),

                h(
                    'strong',
                    null,
                    submission?.status ===
                    'rejected'
                        ? 'Returned for correction'
                        : submission?.status ===
                            'approved'
                            ? 'Final approval completed'
                            : 'Decision recorded'
                ),

                h(
                    'p',
                    null,
                    submission?.status ===
                    'rejected'
                        ? 'This approval cycle has ended. The plan must be corrected and resubmitted before review can continue.'
                        : submission?.status ===
                            'approved'
                            ? 'The Strategic Plan has completed every configured approval stage.'
                            : 'The plan has advanced to the next configured workflow stage.'
                )
            )
            : h(
                React.Fragment,
                null,

                h(
                    'div',
                    {
                        className:
                            'plan-review-decision-guidance',
                    },

                    h('i', {
                        className:
                            'bi bi-info-circle-fill',
                        'aria-hidden': 'true',
                    }),

                    h(
                        'p',
                        null,
                        'Approval advances the plan to the next stage. Returning it ends the current cycle and requires a correction comment.'
                    )
                ),

                h(
                    'div',
                    {
                        className:
                            'plan-review-decision-actions',
                    },

                    !isSubmissionAssignedToReviewer(submission, session) ? h('p', { className: 'office-muted' }, 'Only the reviewer assigned to this stage can record a decision.') : null,
                    isSubmissionAssignedToReviewer(submission, session) ? h(
                        'button',
                        {
                            className:
                                'ui-button ui-button--danger',
                            type: 'button',
                            disabled:
                                processingDecision || !isSubmissionAssignedToReviewer(submission, session),
                            onClick: () =>
                                openDecisionDialog(
                                    'reject'
                                ),
                        },
                        h('i', {
                            className:
                                'bi bi-x-lg',
                            'aria-hidden': 'true',
                        }),
                        'Return for correction'
                    ) : null,

                    isSubmissionAssignedToReviewer(submission, session) ? h(
                        'button',
                        {
                            className:
                                'ui-button ui-button--primary',
                            type: 'button',
                            disabled:
                                processingDecision || !isSubmissionAssignedToReviewer(submission, session),
                            onClick: () =>
                                openDecisionDialog(
                                    'approve'
                                ),
                        },
                        h('i', {
                            className:
                                'bi bi-check-lg',
                            'aria-hidden': 'true',
                        }),
                        'Approve'
                    ) : null
                )
            )
    )
),
                                h(
                                    Accordion,
                                    {
                                        id:
                                            'review-workflow',
                                        title:
                                            'Approval Workflow',
                                        count:
                                            workflowStages.length,
                                        open:
                                            openSections.workflow,
                                        onToggle: () =>
                                            toggleSection(
                                                'workflow'
                                            ),
                                    },

                                    workflowStages.length
                                        ? h(
                                            'ol',
                                            {
                                                className:
                                                    'plan-review-workflow-list',
                                            },

                                            workflowStages.map(
                                                (
                                                    stage,
                                                    index
                                                ) => {
                                                    const current =
                                                        index ===
                                                        submission
                                                            ?.currentStageIndex;

                                                    const completed =
                                                        index <
                                                        submission
                                                            ?.currentStageIndex;

                                                    return h(
                                                        'li',
                                                        {
                                                            className:
                                                                current
                                                                    ? 'is-current'
                                                                    : completed
                                                                        ? 'is-completed'
                                                                        : '',
                                                            key:
                                                                stage.id ||
                                                                index,
                                                        },

                                                        h(
                                                            'span',
                                                            null,
                                                            completed
                                                                ? h(
                                                                    'i',
                                                                    {
                                                                        className:
                                                                            'bi bi-check-lg',
                                                                    }
                                                                )
                                                                : index +
                                                                    1
                                                        ),

                                                        h(
                                                            'div',
                                                            null,
                                                            h(
                                                                'strong',
                                                                null,
                                                                stage.name
                                                            ),
                                                            h(
                                                                'small',
                                                                null,
                                                                stage.approver
                                                            )
                                                        )
                                                    );
                                                }
                                            )
                                        )
                                        : renderEmpty(
                                            'Workflow stage information is unavailable.'
                                        )
                                ),

                                h(
                                    Accordion,
                                    {
                                        id:
                                            'review-history',
                                        title:
                                            'Submission History',
                                        count:
                                            history.length,
                                        open:
                                            openSections.history,
                                        onToggle: () =>
                                            toggleSection(
                                                'history'
                                            ),
                                    },

                                    history.length
                                        ? h(
                                            'ul',
                                            {
                                                className:
                                                    'plan-review-history-list',
                                            },

                                            history.map(
                                                (
                                                    item,
                                                    index
                                                ) =>
                                                    h(
                                                        'li',
                                                        {
                                                            key:
                                                                `${item.action}-${item.occurredAt}-${index}`,
                                                        },

                                                        h('i', {
                                                            className:
                                                                'bi bi-clock-history',
                                                            'aria-hidden':
                                                                'true',
                                                        }),

                                                        h(
                                                            'div',
                                                            null,
                                                            h(
                                                                'strong',
                                                                null,
                                                                text(
                                                                    item.action
                                                                )
                                                                    .replaceAll(
                                                                        '_',
                                                                        ' '
                                                                    )
                                                                    .replace(
                                                                        /^./,
                                                                        (
                                                                            letter
                                                                        ) =>
                                                                            letter.toUpperCase()
                                                                    )
                                                            ),
                                                            h(
                                                                'p',
                                                                null,
                                                                [
                                                                    item.actor_name,
                                                                    item.comment,
                                                                    item.stageName,
                                                                    item.assignedApprover
                                                                        ? `Assigned to ${item.assignedApprover}`
                                                                        : '',
                                                                ]
                                                                    .filter(
                                                                        Boolean
                                                                    )
                                                                    .join(
                                                                        ' · '
                                                                    )
                                                            ),
                                                            h(
                                                                'small',
                                                                null,
                                                                formatDateTime(
                                                                    item.occurredAt
                                                                )
                                                            )
                                                        )
                                                    )
                                            )
                                        )
                                        : renderEmpty(
                                            'No submission history is available.'
                                        )
                                )
                            )
                        )
            )
        )
    );
}

ReactDOM.createRoot(root).render(
    h(StrategicPlanReviewApp)
);
