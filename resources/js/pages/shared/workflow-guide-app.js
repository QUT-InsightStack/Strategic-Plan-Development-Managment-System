import { Breadcrumb } from '../../components/PageHeader.js';
import { mountProtectedPage } from '../../access/mount-protected-page.js';
import { getAccessSession } from '../../access/access-session.js';
import { AppSidebar } from '../../components/AppSidebar.js';

const h = React.createElement;

const stages = [
{
    title: 'Prepare the planning references',
    roles: ['Administrative Admin', 'Technical Admin', 'Management'],
    description:
        'Planning references provide a consistent foundation for strategic plans and objective alignment.',
    details: [
        'Administrative Admin maintains PDP Chapters and Presidential Agenda items.',
        'Management and Technical Admin can perform authorised reference-data deletion actions.',
        'Administrative Admin cannot delete Presidential Agenda items.',
        'Deletion remains subject to permissions and record lifecycle rules.',
        'Reference records are used when mapping objectives to national priorities.',
    ],
},
    {
        title: 'Create a draft plan',
        roles: ['Planning Officer', 'Administrative Admin'],
        description:
            'Create the plan and define its mission, vision and core values. The Plan Overview brings its sections together.',
        details: [
            'Planning Officers manage their own plans.',
            'Administrative Admin can access and manage plans across creators.',
            'Use the overview links to return to each section when changes are needed.',
        ],
    },
    {
        title: 'Build objectives and mappings',
        roles: ['Planning Officer', 'Administrative Admin'],
        description:
            'Add objectives, indicators, targets and responsible Offices or Units, then map objectives to PDP Chapters or Presidential Agenda items.',
        details: [
            'Indicators and targets describe how achievement will be measured.',
            'Responsible Office or Unit assignments identify who will report progress after approval.',
            'After mapping, use Review Plan to check the complete plan.',
        ],
    },
    {
    title: 'Collect and consolidate inputs',
    roles: [
        'Office / Unit',
        'Management',
        'Planning Officer',
        'Administrative Admin',
    ],
    description:
        'Offices provide feedback on plans, objectives and mappings. Both Offices and Management can propose new objectives for draft plans.',
    details: [
        'Objective suggestions are blocked once a plan is finalized.',
        'Submitting a suggestion does not automatically create an objective or change the plan.',
        'Planning Officers and Administrative Admin review eligible inputs and record decisions and reviewer remarks.',
        'Planning Inputs separates Office-related inputs from Management-related inputs.',
        'Offices can upload supporting documents against a plan.',
'The plan’s Planning Officer and authorised Administrative Admins can view and download these files through Planning Inputs → Office Inputs → Supporting Documents. The list shows documents across authorised active plans and can be filtered by plan.',
'Supporting documents are separate from suggestions and feedback. They do not require an Accept or Decline decision.',
        'Management can view authorised consolidated inputs but cannot accept or decline them.',
        'Contributors can track suggestion decisions and reviewer remarks through My Inputs.',
    ],
},
{
    title: 'Discuss objectives with Management',
    roles: ['Management', 'Planning Officer', 'Administrative Admin'],
    description:
        'Management can comment on existing objectives in authorised draft and finalized plans. These comments have their own acknowledgement and completion workflow.',
    details: [
        'Open Plan Review, select a plan and use its objective comments section.',
        'New comments start as Not Acknowledged and Open.',
        'The authorised Planning Officer or Administrative Admin acknowledges the comment through Planning Inputs, under Management Inputs.',
        'Acknowledgement records who has seen the comment; it does not mean the requested work is complete.',
        'After acknowledgement, only the Management author can close the comment as Completed or Incomplete, with mandatory closing remarks.',
        'Management comments do not use the Accept or Decline actions for objective suggestions.',
        'Comment actions do not automatically change objectives, progress or approval status.',
        'Archived or deleted content cannot receive comment actions.',
    ],
},
    {
        title: 'Check readiness and submit',
        roles: ['Planning Officer', 'Administrative Admin'],
        description:
            'Review the full plan, resolve readiness requirements and submit it through the configured approval workflow.',
        details: [
            'Missing indicators must be added inside the relevant objectives.',
            'Pending inputs must be reviewed and consolidated before submission.',
            'Finalising a plan does not mean it has been approved.',
            'Technical Admin can save multiple workflows, each with multiple approval levels, and keep only one active at a time.',
'New submissions and resubmissions automatically use the currently active workflow.',
'Switching the active workflow does not change stages or reviewers for plans already under approval.',
'Submission is blocked when no valid workflow is active.',
        ],
    },
    {
        title: 'Review and decide',
        roles: ['Assigned reviewers'],
        description:
            'Assigned reviewers examine the submitted plan and approve or reject it with decision remarks.',
        details: [
            'Review authority depends on the configured workflow and reviewer assignment.',
            'A submitter cannot review their own submission, including an Administrative Admin submitter.',
            'Approval advances the plan through the configured stages.',
            'A rejected plan can be revised and resubmitted, with previous decisions retained in its history.',
            'Final approval protects the approved plan content and enables progress tracking.',
        ],
    },
    {
        title: 'Report and monitor progress',
        roles: ['Assigned Office / Unit', 'Planning Officer', 'Administrative Admin'],
        description:
            'Once the plan is approved, assigned Offices or Units report objective progress. Authorised planners monitor it and make documented corrections.',
        details: [
            'Both progress updates and corrections require a finished, approved plan.',
            'Archived or deleted plans and objectives cannot receive progress updates.',
            'Progress is reported from 0% to 100%; its progress status is calculated automatically.',
            'Planning Officer and Administrative Admin corrections require a reason.',
            'Progress history records updates and corrections separately.',
            'Updating progress does not unlock editing of approved plan content.',
        ],
    },
    {
    title: 'Archive or restore a plan',
    roles: ['Planning Officer', 'Administrative Admin'],
    description:
        'Archive plans that should leave active use while retaining their records.',
    details: [
        'Planning Officers can archive their own eligible draft or finalized plans. Administrative Admin can do so across creators within their authorised scope.',
        'Plans under approval cannot be archived.',
        'Select Archived in the plan-list status filter and click Filter to find archived plans.',
        'Restore returns the plan to its previous Draft or Finalized status and preserves its approval status.',
        'Archived plans cannot receive objective progress updates or corrections.',
    ],
},
];

const roleCards = [
    {
        title: 'Planning Officer',
        names: ['Planning Officer'],
        icon: 'bi-pencil-square',
        description:'Creates and manages their own plans, objectives and mappings; reviews planning inputs; acknowledges Management objective comments; submits or resubmits plans; and monitors or corrects authorised progress after approval. Can archive and restore their own eligible plans.',
    },
    {
        title: 'Administrative Admin',
        names: ['Administrative Admin', 'Administrative Administrator'],
        icon: 'bi-journal-check',
        description:'Maintains planning references and manages planning work across creators. Reviews inputs, acknowledges Management objective comments, submits plans and corrects authorised progress. Can archive and restore eligible plans. Cannot delete Presidential Agenda items. Approval decisions require workflow assignment and cannot concern their own submission.',
    },
    {
        title: 'Office / Unit',
        names: [
            'Office',
            'Responsible Unit User',
            'Office Representative',
            'Office/Agency',
            'Offices / Agencies',
        ],
        icon: 'bi-building',
        description:
            'Contributes proposals and feedback within their authorised scope, tracks input decisions and reports progress for assigned objectives after plan approval.',
    },
    {
        title: 'Management',
        names: ['Management'],
        icon: 'bi-person-check',
        description:'Views authorised plans and reports, proposes objectives for draft plans, and comments on existing objectives during drafting or after finalization. Closes their own acknowledged comments with an outcome and remarks. Reviews submissions when assigned. Cannot accept or decline consolidated inputs. Can delete plans, objectives, mappings and reference data where permissions and lifecycle rules allow.',
    },
    {
        title: 'Technical Admin',
        names: ['Technical Administrator', 'Technical Admin'],
        icon: 'bi-gear',
        description:'Manages accounts, roles, permissions, security settings, backups and approval configuration. Handles password assistance and can disable Administrative Admin accounts, subject to safeguards. Performs authorised deletion actions. This role alone does not grant approval authority.',
    },
];

function sectionHeading(id, title, description) {
    return h(
        React.Fragment,
        null,
        h('h2', { id }, title),
        h('p', { className: 'workflow-guide__intro' }, description)
    );
}

function statusTable(caption, rows) {
    return h(
        'div',
        { className: 'workflow-guide__table-wrap' },
        h(
            'table',
            { className: 'workflow-guide__table' },
            h('caption', { className: 'sr-only' }, caption),
            h(
                'thead',
                null,
                h(
                    'tr',
                    null,
                    h('th', { scope: 'col' }, 'Status'),
                    h('th', { scope: 'col' }, 'What it means')
                )
            ),
            h(
                'tbody',
                null,
                rows.map(([label, meaning]) =>
                    h(
                        'tr',
                        { key: label },
                        h('th', { scope: 'row' }, label),
                        h('td', null, meaning)
                    )
                )
            )
        )
    );
}

function WorkflowGuideApp() {
    const session = getAccessSession();

    return h(
        React.Fragment,
        null,
        h(AppSidebar),
        h(
            'main',
            { className: 'app-shell-main workflow-guide' },
            h(
                'div',
                { className: 'workflow-guide__container' },

                h(
                    'header',
                    { className: 'workflow-guide__hero' },
                    h(Breadcrumb, { section: 'How SPDMS Works' }),
                    h('h1', null, 'How SPDMS Works'),
                    h(
                        'p',
                        null,
                        'Follow a strategic plan from its first draft to approval and progress reporting. Learn who contributes, who makes decisions and what happens at each stage.'
                    ),
                    h(
                        'div',
                        { className: 'workflow-guide__hero-note' },
                        h('i', {
                            className: 'bi bi-info-circle',
                            'aria-hidden': true,
                        }),
                        'Available actions depend on your role, permissions and assigned records.'
                    )
                ),

                h(
                    'nav',
                    {
                        className: 'workflow-guide__jump-links',
                        'aria-label': 'Guide sections',
                    },
                    [
                        ['workflow', 'Planning workflow'],
                        ['roles', 'Who does what'],
                        ['statuses', 'Understanding statuses'],
                        ['support', 'Account support'],
                    ].map(([id, label]) =>
                        h('a', { key: id, href: `#${id}` }, label)
                    )
                ),

                h(
                    'section',
                    {
                        className: 'workflow-guide__section',
                        'aria-labelledby': 'workflow',
                    },
                    sectionHeading(
                        'workflow',
                        'From draft to delivery',
                        'The main stages below show how people and information move through the system. Expand a stage for practical details.'
                    ),
                    h(
                        'div',
                        { className: 'workflow-guide__steps' },
                        stages.map((stage, index) =>
                            h(
                                'article',
                                {
                                    key: stage.title,
                                    className: 'workflow-guide__step',
                                },
                                h(
                                    'div',
                                    {
                                        className: 'workflow-guide__number',
                                        'aria-label': `Stage ${index + 1}`,
                                    },
                                    index + 1
                                ),
                                h(
                                    'div',
                                    null,
                                    h('h3', null, stage.title),
                                    h(
                                        'div',
                                        { className: 'workflow-guide__roles' },
                                        stage.roles.map((role) =>
                                            h(
                                                'span',
                                                {
                                                    key: role,
                                                    className: 'workflow-guide__badge',
                                                },
                                                role
                                            )
                                        )
                                    ),
                                    h('p', null, stage.description),
                                    h(
                                        'details',
                                        { className: 'workflow-guide__detail' },
                                        h('summary', null, 'What happens here'),
                                        h(
                                            'ul',
                                            null,
                                            stage.details.map((detail) =>
                                                h('li', { key: detail }, detail)
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                ),

                h(
                    'section',
                    {
                        className: 'workflow-guide__section',
                        'aria-labelledby': 'roles',
                    },
                    sectionHeading(
                        'roles',
                        'Who does what',
                        'Each role contributes to a different part of planning, review, delivery or system support.'
                    ),
                    h(
                        'div',
                        { className: 'workflow-guide__grid' },
                        roleCards.map((role) => {
                            const current = role.names.includes(session?.roleName);

                            return h(
                                'article',
                                {
                                    key: role.title,
                                    className:
                                        'workflow-guide__card' +
                                        (current ? ' workflow-guide__card--current' : ''),
                                },
                                h('i', {
                                    className: `bi ${role.icon} workflow-guide__card-icon`,
                                    'aria-hidden': true,
                                }),
                                h('h3', null, role.title),
                                current &&
                                    h(
                                        'p',
                                        null,
                                        h(
                                            'span',
                                            { className: 'workflow-guide__badge' },
                                            'Your role'
                                        )
                                    ),
                                h('p', null, role.description)
                            );
                        })
                    ),
                    h(
                        'div',
                        { className: 'workflow-guide__notice' },
                        'A role describes responsibilities. It does not automatically grant access to every plan or approval task. Ownership, Office or Unit assignments, permissions and workflow assignments also apply.'
                    )
                ),

                h(
                    'section',
                    {
                        className: 'workflow-guide__section',
                        'aria-labelledby': 'statuses',
                    },
                    sectionHeading(
                        'statuses',
                        'Understanding statuses',
                        'Plan preparation, approval and objective progress are separate. A finished plan can still be waiting for approval.'
                    ),
                    statusTable('Plan and approval statuses', [
                        ['Draft', 'The plan is being prepared and can receive objective proposals.'],
                        ['Finished / Finalised', 'Plan preparation is complete. This alone does not enable progress updates.'],
                        ['Not submitted', 'The plan has not entered an approval cycle.'],
                        ['Under approval', 'The submitted plan is waiting for decisions through its configured approval stages.'],
                        ['Rejected', 'A reviewer has rejected the submission. Authorised planners can revise and resubmit it.'],
                        ['Approved', 'All required approval stages are complete. A finished, approved plan can receive progress updates.'],
                        ['Archived', 'The plan is retained outside active use. Progress updates and corrections are blocked. Authorised restoration returns it to its previous Draft or Finalized status.'],
                        ['Deleted', 'The record is unavailable for normal use. Progress updates and corrections are blocked.'],
                    ]),
                    h(
                        'div',
                        { className: 'workflow-guide__notice' },
                        h('strong', null, 'Objective progress: '),
                        '0% is Not Started, 1–99% is In Progress, and 100% is Completed. An objective’s content status, such as draft or published, is separate from its progress status.'
                    )
                ),

                h(
                    'section',
                    {
                        className: 'workflow-guide__section',
                        'aria-labelledby': 'support',
                    },
                    sectionHeading(
                        'support',
                        'Getting account support',
                        'Password assistance connects users who cannot sign in with authorised system administrators.'
                    ),
                    h(
                        'article',
                        { className: 'workflow-guide__card' },
                        h('h3', null, 'Forgot your password?'),
                        h(
                            'p',
                            null,
                            'Use Forgot Password on the login page to submit an assistance request. An authorised Technical Admin can review the request, accept it and reset the password through User Management, or ignore the request.'
                        ),
                        h(
                            'p',
                            null,
                            'Follow your organisation’s identity-verification and password handover process. A completed reset invalidates the account’s previous sessions.'
                        )
                    )
                )
            )
        )
    );
}

mountProtectedPage(
    document.getElementById('root'),
    () => h(WorkflowGuideApp)
);