import { AppSidebar } from '../../components/AppSidebar.js';
import { PageHeader } from '../../components/PageHeader.js';
import { enforcePageAccess } from '../../access/access-guard.js';
import { getApprovalStatus } from '../../api/plan-approval-api.js';

enforcePageAccess();
const h = React.createElement;
const { useEffect, useState } = React;
const root = document.getElementById('root');
const planId = Number(root.dataset.planId);
const label = value => String(value || '').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
const date = value => value ? new Date(value).toLocaleString() : '—';

function ApprovalStatusApp() {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError('');
        getApprovalStatus(planId).then(response => { if (active) setData(response.data); })
            .catch(error => { if (active) { setError(error.message); setData(null); } })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [refresh]);
    const current = data?.current_stage;
    return h(React.Fragment, null,
        h(AppSidebar),
        h('main', { className: 'app-shell-main plan-review-page' }, h('div', { className: 'app-shell-container plan-review-container' },
            h(PageHeader, { section: 'Approval status', title: data?.title || 'Approval status',
                subtitle: 'Track the current stage and recorded actions across approval cycles.',
                actions: h('button', { className: 'ui-button ui-button--secondary', disabled: loading, onClick: () => setRefresh(value => value + 1) }, 'Refresh'),
            }),
            error && h('p', { className: 'ui-status ui-status--error', role: 'alert' }, error),
            loading && h('p', { role: 'status' }, 'Loading approval status…'),
            data && h(React.Fragment, null,
                h('section', { className: 'ui-card' }, h('div', { className: 'ui-card__body' },
                    h('h2', null, label(data.status)),
                    h('p', null, data.current_submission ? `${data.current_submission.workflow_name} · Version ${data.current_submission.workflow_version}` : 'This plan has not been submitted.'),
                    h('p', null, current ? `Current stage: ${current.sequence}. ${current.name}` : 'No stage is awaiting approval.'),
                    current && h('p', null, `Assigned to: ${current.approver_label}`),
                    current && h('p', null, `Reviewers: ${current.reviewers.map(reviewer => reviewer.pivot?.reviewer_name || [reviewer.first_name, reviewer.last_name].join(' ')).join(', ')}`),
                    data.can_resubmit && h('a', { className: 'ui-button ui-button--primary', href: `/strategic-plans/${planId}/finalize` }, 'Review revisions and resubmit'),
                    data.can_review && h('p', null, h('a', { href: `/strategic-plan-reviews/${planId}` }, 'Open submitted plan')),
                )),
                h('section', { className: 'ui-card' }, h('div', { className: 'ui-card__body' },
                    h('h2', null, 'Approval history'),
                    data.history.length ? h('div', { className: 'plans-table-wrap' }, h('table', { className: 'plans-table' },
                        h('thead', null, h('tr', null, ['Cycle', 'Action', 'Stage / approver', 'Recorded by', 'Date', 'Comments'].map(title => h('th', { key: title, scope: 'col' }, title)))),
                        h('tbody', null, data.history.map(event => h('tr', { key: event.id },
                            h('td', null, `#${event.submission_id}`), h('td', null, label(event.action)),
                            h('td', null, `${event.stage_name} · ${event.approver}`), h('td', null, event.actor_name),
                            h('td', null, date(event.created_at)), h('td', null, event.comment || '—'),
                        ))),
                    )) : h('p', null, 'No approval history yet.'),
                )),
            ),
        )),
    );
}

ReactDOM.createRoot(root).render(h(ApprovalStatusApp));
