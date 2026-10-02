import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { getApprovalStatus } from '../../api/plan-approval-api.js';

enforcePageAccess();

const h = React.createElement;
const { useEffect, useState } = React;
const root = document.getElementById('root');
const planId = Number(root.dataset.planId);

const label = value => String(value || '')
    .replaceAll('_', ' ')
    .replace(/^./, character => character.toUpperCase());

const statusClass = value =>
    String(value || 'not_submitted').replaceAll('_', '-');

const formatDate = value => {
    if (!value) return '—';

    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime())
        ? '—'
        : parsed.toLocaleString();
};

const reviewerName = reviewer =>
    reviewer?.pivot?.reviewer_name
    || [reviewer?.first_name, reviewer?.last_name]
        .filter(Boolean)
        .join(' ')
    || 'Assigned reviewer';

const statusIcon = status => ({
    approved: 'bi-check-circle-fill',
    rejected: 'bi-x-circle-fill',
    under_approval: 'bi-hourglass-split',
    not_submitted: 'bi-dash-circle',
    current: 'bi-hourglass-split',
    pending: 'bi-clock',
    submitted: 'bi-send-check-fill',
    resubmitted: 'bi-arrow-repeat',
    stage_started: 'bi-play-circle-fill',
}[status] || 'bi-info-circle-fill');

function statusBadge(status) {
    return h(
        'span',
        {
            className:
                `approval-status-badge approval-status-badge--${statusClass(status)}`,
        },
        h('i', {
            className: `bi ${statusIcon(status)}`,
            'aria-hidden': 'true',
        }),
        label(status),
    );
}

function summaryCard(title, content) {
    return h(
        'div',
        { className: 'approval-status-card' },
        h('span', { className: 'approval-status-card__label' }, title),
        h('div', { className: 'approval-status-card__value' }, content),
    );
}

function currentStageSection(stage) {
    if (!stage) {
        return h(
            'section',
            { className: 'approval-status-card approval-current-stage' },
            h(
                'div',
                { className: 'approval-empty-state' },
                h('i', {
                    className: 'bi bi-check2-circle',
                    'aria-hidden': 'true',
                }),
                h('strong', null, 'No stage is awaiting approval'),
                h(
                    'p',
                    null,
                    'This workflow is either complete or has not started.',
                ),
            ),
        );
    }

    const reviewers = Array.isArray(stage.reviewers)
        ? stage.reviewers
        : [];

    return h(
        'section',
        {
            className: 'approval-status-card approval-current-stage',
            'aria-labelledby': 'current-stage-heading',
        },
        h(
            'div',
            { className: 'approval-current-stage__header' },
            h(
                'span',
                {
                    className: 'approval-current-stage__number',
                    'aria-hidden': 'true',
                },
                stage.sequence,
            ),
            h(
                'div',
                { className: 'approval-current-stage__title' },
                h(
                    'h2',
                    { id: 'current-stage-heading' },
                    stage.name,
                ),
                h(
                    'p',
                    null,
                    `Required approver: ${stage.approver_label || '—'}`,
                ),
            ),
            statusBadge(stage.status || 'current'),
        ),
        h(
            'span',
            { className: 'approval-status-card__label' },
            'Assigned reviewer(s)',
        ),
        reviewers.length
            ? h(
                'div',
                { className: 'approval-reviewer-list' },
                reviewers.map(reviewer =>
                    h(
                        'span',
                        {
                            className: 'approval-reviewer',
                            key:
                                reviewer.user_id
                                || reviewerName(reviewer),
                        },
                        h('i', {
                            className: 'bi bi-person-fill',
                            'aria-hidden': 'true',
                        }),
                        reviewerName(reviewer),
                    ),
                ),
            )
            : h(
                'p',
                null,
                'No individual reviewer has been resolved for this stage.',
            ),
    );
}

function stageSequence(stages) {
    if (!stages.length) return null;

    return h(
        'section',
        {
            className: 'approval-status-card',
            'aria-labelledby': 'stage-sequence-heading',
        },
        h(
            'h2',
            { id: 'stage-sequence-heading' },
            'Approval sequence',
        ),
        h(
            'div',
            { className: 'approval-stage-list' },
            stages.map(stage =>
                h(
                    'div',
                    {
                        className:
                            `approval-stage-item${
                                stage.status === 'current'
                                    ? ' approval-stage-item--current'
                                    : ''
                            }`,
                        key: stage.id || stage.sequence,
                    },
                    h(
                        'span',
                        { className: 'approval-stage-item__number' },
                        stage.sequence,
                    ),
                    h(
                        'div',
                        null,
                        h(
                            'div',
                            { className: 'approval-stage-item__name' },
                            stage.name,
                        ),
                        h(
                            'div',
                            {
                                className:
                                    'approval-stage-item__approver',
                            },
                            stage.approver_label
                            || 'Approver not available',
                        ),
                    ),
                    statusBadge(stage.status),
                ),
            ),
        ),
    );
}

function approvalHistory(history) {
    return h(
        'section',
        {
            className:
                'approval-status-card approval-history-section',
            'aria-labelledby': 'approval-history-heading',
        },
        h(
            'h2',
            { id: 'approval-history-heading' },
            'Approval history',
        ),
        history.length
            ? h(
                'div',
                { className: 'plans-table-wrap' },
                h(
                    'table',
                    { className: 'plans-table' },
                    h(
                        'thead',
                        null,
                        h(
                            'tr',
                            null,
                            [
                                'Cycle',
                                'Action',
                                'Stage / approver',
                                'Recorded by',
                                'Date',
                                'Comments',
                            ].map(title =>
                                h(
                                    'th',
                                    { key: title, scope: 'col' },
                                    title,
                                ),
                            ),
                        ),
                    ),
                    h(
                        'tbody',
                        null,
                        history.map(event =>
                            h(
                                'tr',
                                { key: event.id },
                                h(
                                    'td',
                                    null,
                                    `#${event.submission_id}`,
                                ),
                                h(
                                    'td',
                                    null,
                                    statusBadge(event.action),
                                ),
                                h(
                                    'td',
                                    null,
                                    h(
                                        'strong',
                                        null,
                                        event.stage_name
                                        || 'Workflow',
                                    ),
                                    h(
                                        'div',
                                        {
                                            className:
                                                'approval-stage-item__approver',
                                        },
                                        event.approver || '—',
                                    ),
                                ),
                                h(
                                    'td',
                                    null,
                                    event.actor_name || 'System',
                                ),
                                h(
                                    'td',
                                    null,
                                    formatDate(event.created_at),
                                ),
                                h(
                                    'td',
                                    {
                                        className:
                                            'approval-history-comment',
                                    },
                                    event.comment || '—',
                                ),
                            ),
                        ),
                    ),
                ),
            )
            : h(
                'div',
                { className: 'approval-empty-state' },
                h('i', {
                    className: 'bi bi-clock-history',
                    'aria-hidden': 'true',
                }),
                h('strong', null, 'No approval history yet'),
                h(
                    'p',
                    null,
                    'Workflow actions will appear here after the plan is submitted.',
                ),
            ),
    );
}

function ApprovalStatusApp() {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        let active = true;

        setLoading(true);
        setError('');

        getApprovalStatus(planId)
            .then(response => {
                if (active) setData(response.data);
            })
            .catch(requestError => {
                if (active) {
                    setError(
                        requestError.message
                        || 'Unable to load the approval status.',
                    );
                    setData(null);
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [refresh]);

    const currentSubmission = data?.current_submission;
    const stages = Array.isArray(currentSubmission?.stages)
        ? currentSubmission.stages
        : [];

    return h(
        React.Fragment,
        null,
        h(AppSidebar),
        h(
            'main',
            {
                className:
                    'app-shell-main plan-review-page approval-status-page',
            },
            h(
                'div',
                {
                    className:
                        'app-shell-container plan-review-container',
                },
                h(PageHeader, {
                    section: 'Approval status',
                    title: data?.title || 'Approval status',
                    subtitle:
                        'Track the current stage, assigned approvers and recorded workflow actions.',
                    actions: h(
                        'div',
                        { className: 'approval-actions' },
                        h(
                            'a',
                            {
                                className:
                                    'ui-button ui-button--secondary',
                                href: '/strategic-plans',
                            },
                            'Back to plans',
                        ),
                        h(
                            'button',
                            {
                                className:
                                    'ui-button ui-button--secondary',
                                type: 'button',
                                disabled: loading,
                                onClick: () =>
                                    setRefresh(value => value + 1),
                            },
                            loading ? 'Refreshing…' : 'Refresh',
                        ),
                    ),
                }),

                error && h(
                    'div',
                    {
                        className:
                            'ui-status ui-status--error',
                        role: 'alert',
                    },
                    h(
                        'strong',
                        null,
                        'Approval status could not be loaded. ',
                    ),
                    error,
                    h(
                        'button',
                        {
                            className:
                                'ui-button ui-button--secondary ui-button--sm',
                            type: 'button',
                            onClick: () =>
                                setRefresh(value => value + 1),
                        },
                        'Try again',
                    ),
                ),

                loading && h(
                    'div',
                    {
                        className: 'approval-status-card',
                        role: 'status',
                        'aria-live': 'polite',
                    },
                    'Loading approval status…',
                ),

                data && h(
                    React.Fragment,
                    null,
                    h(
                        'section',
                        {
                            className: 'approval-status-summary',
                            'aria-label': 'Approval summary',
                        },
                        summaryCard(
                            'Overall status',
                            statusBadge(data.status),
                        ),
                        summaryCard(
                            'Workflow',
                            currentSubmission?.workflow_name
                            || 'Not assigned',
                        ),
                        summaryCard(
                            'Workflow version',
                            currentSubmission
                                ? `Version ${
                                    currentSubmission.workflow_version
                                }`
                                : '—',
                        ),
                    ),

                    currentStageSection(data.current_stage),

                    stageSequence(stages),

                    h(
                        'div',
                        { className: 'approval-actions' },
                        data.can_resubmit && h(
                            'a',
                            {
                                className:
                                    'ui-button ui-button--primary',
                                href:
                                    `/strategic-plans/${planId}/finalize`,
                            },
                            'Review revisions and resubmit',
                        ),
                        data.can_review && h(
                            'a',
                            {
                                className:
                                    'ui-button ui-button--secondary',
                                href:
                                    `/strategic-plan-reviews/${planId}`,
                            },
                            'Open submitted plan',
                        ),
                    ),

                    approvalHistory(
                        Array.isArray(data.history)
                            ? data.history
                            : [],
                    ),
                ),
            ),
        ),
    );
}

ReactDOM.createRoot(root).render(h(ApprovalStatusApp));