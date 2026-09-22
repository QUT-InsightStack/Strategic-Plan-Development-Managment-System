import { AppSidebar } from '../../components/AppSidebar.js';
import { getStrategicPlan, listStrategicPlans } from '../../api/strategic-plans-api.js';
import { listStrategicObjectives } from '../../api/strategic-objectives-api.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { apiRequest } from '../../api/api-client.js';
import { submitStrategicPlan, resubmitStrategicPlan, getApprovalStatus } from '../../api/plan-approval-api.js';

enforcePageAccess();

const h = React.createElement;
const { useEffect, useState } = React;
const root = document.getElementById('root');
const routePlanId = Number(root.dataset.planId) || null;

const text = value => String(value || '').trim();
const formatDate = value => value
    ? new Date(value).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    })
    : '—';

const formatDateTime = value => value
    ? new Date(value).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
    : '—';

const creatorName = creator => creator
    ? [creator.first_name, creator.last_name]
        .filter(Boolean)
        .join(' ') || creator.email
    : '—';

const planStatusLabel = status =>
    status === 'finished'
        ? 'Finalized'
        : (status || 'draft').replace(/^./, letter => letter.toUpperCase());

const latestRejection = tracking =>
    [...(tracking?.history || [])]
        .reverse()
        .find(event => event.action === 'rejected') || null;
function Accordion({ id, title, count, open, onToggle, children }) {
    return h('section', { className: 'finalize-accordion' },
        h('button', { className: 'finalize-accordion__toggle', type: 'button', onClick: onToggle, 'aria-expanded': open, 'aria-controls': id },
            h('span', null, `${title}${count === null ? '' : ` (${count})`}`),
            h('i', { className: `bi bi-chevron-${open ? 'up' : 'down'}`, 'aria-hidden': 'true' })
        ),
        open ? h('div', { className: 'finalize-accordion__body', id }, children) : null
    );
}

function DecisionDialog({ dialog, busy, onCancel, onConfirm }) {
    if (!dialog.open) return null;
    const confirmation = dialog.mode === 'confirm';
    return h('div', { className: 'ui-dialog-backdrop', role: 'presentation' },
        h('section', { className: `ui-dialog ${confirmation ? 'finalize-dialog' : dialog.mode === 'error' ? 'ui-dialog--error' : 'ui-dialog--success'}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'finalize-dialog-title', 'aria-describedby': 'finalize-dialog-message' },
            h('div', { className: 'ui-dialog__icon', 'aria-hidden': 'true' }, h('i', { className: `bi ${dialog.mode === 'error' ? 'bi-exclamation-lg' : confirmation ? 'bi-send-check' : 'bi-check-lg'}` })),
            h('h2', { id: 'finalize-dialog-title' }, dialog.title),
            h('p', { id: 'finalize-dialog-message' }, dialog.message),
            h('div', { className: 'ui-dialog__actions' },
                confirmation ? h('button', { className: 'ui-button ui-button--secondary', type: 'button', disabled: busy, onClick: onCancel }, 'Cancel') : null,
                h('button', { className: `ui-button ${dialog.mode === 'error' ? 'ui-button--danger-solid' : 'ui-button--primary'}`, type: 'button', disabled: busy, onClick: confirmation ? onConfirm : onCancel }, busy ? 'Submitting…' : confirmation ? (dialog.resubmission ? 'Resubmit for Approval' : 'Submit for Approval') : 'Close')
            )
        )
    );
}

function FinalizeStrategicPlanApp() {
    const [plans, setPlans] = useState([]);
    const [planId, setPlanId] = useState(routePlanId);
    const [plan, setPlan] = useState(null);
    const [tracking, setTracking] = useState(null);
    const [revisionNote, setRevisionNote] = useState('');
    const [objectives, setObjectives] = useState([]);
    const [relations, setRelations] = useState([]);
    const [inputMeta, setInputMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState({ type: '', message: '' });
    const [openSections, setOpenSections] = useState({});
    const [dialog, setDialog] = useState({ open: false, mode: '', title: '', message: '' });

    useEffect(() => {
        let active = true;
        listStrategicPlans({ per_page: 100 }).then(payload => {
            if (!active) return;
            const available = payload.data || [];
            setPlans(available);
            if (!routePlanId && available.length) setPlanId(available.find(item => item.status === 'draft')?.record_id || available[0].record_id);
            if (!routePlanId && !available.length) setLoading(false);
        }).catch(error => { if (active) { setNotice({ type: 'error', message: error.message }); setLoading(false); } });
        return () => { active = false; };
    }, []);

    useEffect(() => {
        if (!planId) return;
        let active = true;
        setLoading(true); setNotice({ type: '', message: '' });
        Promise.all([
            getStrategicPlan(planId),
            getApprovalStatus(planId),
            listStrategicObjectives(planId),
            apiRequest(`/api/strategic-plans/${planId}/approval-preparation`),
        ]).then(([planPayload, trackingPayload, objectivePayload, inputPayload]) => {
            if (!active) return;
            const serverPlan = planPayload.data;
            setPlan(serverPlan);
            setTracking(trackingPayload.data);
            setRevisionNote('');
            setObjectives((objectivePayload.data || []).filter(item => !['archived', 'deleted'].includes(item.status)));
            setRelations((objectivePayload.data || []).filter(item => !['archived', 'deleted'].includes(item.status)).flatMap(objective =>
                (objective.pdp_chapters || []).map(chapter => ({ id: `${objective.objective_id}-${chapter.chapter_id}`, objective: objective.objective_title, chapter: chapter.chapter_title }))));
            setInputMeta({ summary: { 'Pending Review': inputPayload.data.pending_inputs } });
        }).catch(error => { if (active) setNotice({ type: 'error', message: error.message }); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [planId]);

    function selectPlan(event) {
        const id = Number(event.target.value);
        setPlanId(id); setPlan(null); setObjectives([]); setRelations([]); setInputMeta(null); setOpenSections({});
        window.history.replaceState({}, '', `/strategic-plans/${id}/finalize`);
    }

    function toggle(section) { setOpenSections(current => ({ ...current, [section]: !current[section] })); }

    const mission = plan?.missionFoundation || plan?.mission_foundation;
    const vision = plan?.visionFoundation || plan?.vision_foundation;
    const coreValues = plan?.coreValues || plan?.core_values || [];
    const outstandingInputs = Number(inputMeta?.summary?.['Pending Review'] || 0);
    const rejection = latestRejection(tracking);
    const checks = plan ? [
        { label: 'Mission and Vision completed', done: Boolean(text(mission?.content) && text(vision?.content)) },
        { label: 'Core Values reviewed', done: coreValues.length > 0 },
        { label: 'Strategic Objectives added', done: objectives.length > 0 },
        { label: 'Objectives mapped to outcomes', done: objectives.length > 0 && objectives.every(item => text(item.expected_outcome)) },
        { label: 'Indicators added', done: objectives.length > 0 && objectives.every(item => text(item.indicator)) },
        { label: 'Agency inputs consolidated', done: inputMeta !== null && outstandingInputs === 0 },
        { label: 'Progress status updated', done: objectives.length > 0 && objectives.every(item => text(item.status)) },
    ] : [];
    const ready = checks.length > 0 && checks.every(item => item.done);

    async function submitPlan() {
    const resubmission = plan?.approval_status === 'rejected';

    const missingPreviousSubmission =
        resubmission && !tracking?.current_submission?.id;

    const cannotResubmit =
        resubmission && !tracking?.can_resubmit;

    if (
        !ready ||
        !plan ||
        missingPreviousSubmission ||
        cannotResubmit ||
        !['draft', 'finished'].includes(plan.status) ||
        ['under_approval', 'approved'].includes(plan.approval_status) ||
        submitting
    ) {
        return;
    }

    setSubmitting(true);

    try {
        const response = resubmission
            ? await resubmitStrategicPlan(
                plan.record_id,
                tracking.current_submission.id,
                revisionNote.trim()
            )
            : await submitStrategicPlan(plan.record_id);

        const finalizedPlan = {
            ...plan,
            status: 'finished',
            approval_status: response.data.status,
        };

        setPlan(finalizedPlan);

        setPlans(current =>
            current.map(item =>
                Number(item.record_id) === Number(plan.record_id)
                    ? { ...item, ...finalizedPlan }
                    : item
            )
        );

        setRevisionNote('');

        setDialog({
            open: true,
            mode: 'success',
            title: resubmission
                ? 'Plan resubmitted'
                : 'Plan submitted',
            message: resubmission
                ? 'The revised strategic plan has started a new approval cycle. Previous approval history has been retained.'
                : 'The strategic plan entered the configured approval workflow.',
        });
    } catch (error) {
        const validationMessage = Object.values(error.errors || {})
            .flat()
            .join(' ');

        setDialog({
            open: true,
            mode: 'error',
            title: resubmission
                ? 'Resubmission failed'
                : 'Submission failed',
            message:
                validationMessage ||
                error.message ||
                'The plan could not be submitted.',
        });
    } finally {
        setSubmitting(false);
    }
}

    const empty = message => h('p', { className: 'finalize-empty' }, message);
    return h(React.Fragment, null,
        h(AppSidebar, { active: 'Finalize Plans', onNotice: message => setNotice({ type: 'info', message }) }),
        h('main', { className: 'app-shell-main finalize-page' }, h('div', { className: 'app-shell-container finalize-container' },
            h('nav', { className: 'finalize-breadcrumb', 'aria-label': 'Breadcrumb' }, h('a', { href: '/strategic-plans' }, 'Strategic Plans'), h('i', { className: 'bi bi-chevron-right' }), h('span', null, 'Finalized Strategic Plan')),
            h('h1', { className: 'finalize-title' }, 'Finalized Strategic Plan'),
            h('p', { className: 'finalize-subtitle' }, 'Review the finalized plan before submitting it for Management approval.'),
            plans.length > 1 && h('label', { className: 'ui-field finalize-plan-picker' }, h('span', { className: 'ui-label' }, 'Strategic plan'), h('select', { className: 'ui-select', value: planId || '', onChange: selectPlan }, plans.map(item => h('option', { value: item.record_id, key: item.record_id }, `${item.title} · ${planStatusLabel(item.status)}`)))),
            notice.message && h('div', { className: `ui-status ui-status--${notice.type} finalize-feedback`, role: notice.type === 'error' ? 'alert' : 'status' }, notice.message),
            loading ? h('section', { className: 'ui-card ui-empty' }, 'Loading finalized plan…') : !plan ? h('section', { className: 'ui-card ui-empty' }, 'No strategic plan is available for finalization.') :
            h('div', { className: 'finalize-layout' },
                h('div', null,
                    h('section', { className: 'ui-card finalize-plan-info', 'aria-labelledby': 'plan-information-title' },
                        h('h2', { className: 'finalize-section-heading', id: 'plan-information-title' }, 'Plan Information'),
                        h('div', { className: 'finalize-info-grid' },
                            [['Plan Title', plan.title], ['Plan Level', (plan.level || 'strategic_plan').replaceAll('_', ' ')], ['Created by Author', creatorName(plan.creator)], ['Date Created', formatDate(plan.created_at)], ['Department / Agency', plan.creator?.department || plan.creator?.office || '—'], ['Status', h('span', { className: `finalize-status is-${plan.status}` }, plan.status === 'finished' ? 'Finalized' : plan.status)]].map(([label, value]) => h('div', { className: 'finalize-info-item', key: label }, h('small', null, label), h('strong', null, value)))
                        )
                    ),
                    h('div', { className: 'finalize-accordions' },
                        h(Accordion, { id: 'foundation-content', title: 'Strategic Foundation (Mission, Vision, Core Values)', count: null, open: openSections.foundation, onToggle: () => toggle('foundation') }, h('div', { className: 'finalize-foundation-grid' }, h('article', null, h('h3', null, 'Mission'), h('p', null, mission?.content || 'Not provided')), h('article', null, h('h3', null, 'Vision'), h('p', null, vision?.content || 'Not provided')), h('article', null, h('h3', null, 'Core Values'), coreValues.length ? h('p', null, coreValues.map(value => value.content || value).join(' · ')) : empty('No core values added.')))),
                        h(Accordion, { id: 'objectives-content', title: 'Strategic Objectives', count: objectives.length, open: openSections.objectives, onToggle: () => toggle('objectives') }, objectives.length ? h('ol', { className: 'finalize-content-list' }, objectives.map(item => h('li', { key: item.objective_id }, h('strong', null, item.objective_title || `Objective ${item.objective_id}`), h('p', null, item.objective_description || 'No description.')))) : empty('No strategic objectives added.')),
                        h(Accordion, { id: 'outcomes-content', title: 'Outcomes', count: objectives.filter(item => text(item.expected_outcome)).length, open: openSections.outcomes, onToggle: () => toggle('outcomes') }, objectives.length ? h('ul', { className: 'finalize-content-list' }, objectives.map(item => h('li', { key: item.objective_id }, h('strong', null, item.objective_title), h('p', null, item.expected_outcome || 'Outcome not provided.')))) : empty('No outcomes available.')),
                        h(Accordion, { id: 'indicators-content', title: 'Indicators', count: objectives.filter(item => text(item.indicator)).length, open: openSections.indicators, onToggle: () => toggle('indicators') }, objectives.length ? h('ul', { className: 'finalize-content-list' }, objectives.map(item => h('li', { key: item.objective_id }, h('strong', null, item.indicator || 'Indicator not provided'), h('p', null, `Target: ${item.target || 'Not provided'}`)))) : empty('No indicators available.')),
                        h(Accordion, { id: 'mapping-content', title: 'Alignment Mapping', count: relations.length, open: openSections.mapping, onToggle: () => toggle('mapping') }, relations.length ? h('ul', { className: 'finalize-content-list' }, relations.map(item => h('li', { key: item.id }, h('strong', null, `${item.agenda_title} → ${item.pdp_chapter?.chapter_title || 'PDP'} → ${item.dost_objective?.objective_title || 'DOST Objective'}`)))) : empty('No alignment mappings added.')),
                        h(Accordion, { id: 'description-content', title: 'Description / Notes', count: null, open: openSections.description, onToggle: () => toggle('description') }, h('p', { className: 'finalize-empty' }, plan.description || 'No description or notes provided.'))
                    )
                ),
                h('aside', { className: 'ui-card finalize-checklist', 'aria-labelledby': 'checklist-title' },
                    h('h2', { className: 'finalize-section-heading', id: 'checklist-title' }, 'Pre-submission Checklist'),
                    h('ul', null, checks.map(item => h('li', { className: item.done ? '' : 'is-missing', key: item.label }, h('i', { className: `bi ${item.done ? 'bi-check-circle' : 'bi-exclamation-circle'}`, 'aria-hidden': 'true' }), h('span', null, item.label)))),
                    h('div', { className: 'finalize-warning' }, h('i', { className: 'bi bi-exclamation-triangle-fill', 'aria-hidden': 'true' }), h('span', null, plan.approval_status === 'under_approval' ? 'This plan is under approval in the configured workflow.' : ready ? 'A snapshot of this plan and its supporting information will be sent for approval.' : 'Complete every checklist item before submitting the plan.')),
                    plan.approval_status === 'rejected' && h(
    'section',
    {
        className: 'finalize-rejection',
        'aria-labelledby': 'rejection-title',
    },

    h(
        'div',
        { className: 'finalize-rejection__heading' },

        h('i', {
            className: 'bi bi-x-circle-fill',
            'aria-hidden': 'true',
        }),

        h(
            'h3',
            { id: 'rejection-title' },
            'Plan rejected'
        )
    ),

    h(
        'dl',
        { className: 'finalize-rejection__details' },

        h(
            'div',
            null,
            h('dt', null, 'Stage'),
            h('dd', null, rejection?.stage_name || 'Approval review')
        ),

        h(
            'div',
            null,
            h('dt', null, 'Rejected by'),
            h(
                'dd',
                null,
                rejection?.actor_name || rejection?.approver || '—'
            )
        ),

        h(
            'div',
            null,
            h('dt', null, 'Date'),
            h('dd', null, formatDateTime(rejection?.created_at))
        )
    ),

    h(
        'div',
        { className: 'finalize-rejection__reason' },

        h('strong', null, 'Reason for rejection'),

        h(
            'p',
            null,
            rejection?.comment ||
                'No rejection comment was recorded. Review the approval history for more information.'
        )
    ),

    !tracking?.can_resubmit && h(
        'p',
        {
            className: 'ui-status ui-status--warning',
            role: 'status',
        },
        'This plan is not currently eligible for resubmission.'
    ),

    h(
        'div',
        { className: 'ui-field finalize-revision-note' },

        h(
            'label',
            {
                className: 'ui-label',
                htmlFor: 'revision-note',
            },
            'Revision note (optional)'
        ),

        h('textarea', {
            id: 'revision-note',
            className: 'ui-input',
            maxLength: 5000,
            rows: 4,
            value: revisionNote,
            onChange: event => setRevisionNote(event.target.value),
            placeholder:
                'Summarise the changes made in response to the rejection.',
        }),

        h(
            'div',
            { className: 'finalize-revision-note__meta' },

            h(
                'span',
                { className: 'ui-help' },
                'This note will be recorded in the new approval cycle.'
            ),

            h(
                'span',
                null,
                `${revisionNote.length.toLocaleString()} / 5,000`
            )
        )
    )
),
                    h('div', { className: 'finalize-actions' },
                        tracking?.current_submission && h('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: `/strategic-plans/${plan.record_id}/approval-status` }, 'Approval status and history'),
                        h('a', { className: 'ui-button ui-button--secondary ui-button--sm', href: `/strategic-plans/${plan.record_id}/edit` }, 'View / Update'),
                    h(
    'button',
    {
        className: 'ui-button ui-button--primary ui-button--sm',
        type: 'button',

        disabled:
            !ready ||
            (
                plan.approval_status === 'rejected' &&
                (
                    !tracking?.can_resubmit ||
                    !tracking?.current_submission?.id
                )
            ) ||
            !['draft', 'finished'].includes(plan.status) ||
            ['under_approval', 'approved'].includes(
                plan.approval_status
            ) ||
            submitting,

        onClick: () =>
            setDialog({
                open: true,
                mode: 'confirm',
                resubmission:
                    plan.approval_status === 'rejected',

                title:
                    plan.approval_status === 'rejected'
                        ? 'Resubmit the revised plan?'
                        : 'Submit this plan for approval?',

                message:
                    plan.approval_status === 'rejected'
                        ? 'The revised plan will start a new approval cycle using the active workflow. The previous rejection and approval history will be retained.'
                        : 'The plan will enter the configured approval workflow.',
            }),
    },

    plan.approval_status === 'under_approval'
        ? 'Submitted'
        : plan.approval_status === 'approved'
            ? 'Approved'
            : plan.approval_status === 'rejected'
                ? 'Resubmit for Approval'
                : 'Submit for Approval'
)
                    )
                )
            )
        )),
        h(DecisionDialog, { dialog, busy: submitting, onCancel: () => setDialog({ open: false, mode: '', title: '', message: '' }), onConfirm: submitPlan })
    );
}

ReactDOM.createRoot(root).render(h(FinalizeStrategicPlanApp));
