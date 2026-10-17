import { apiRequest } from '../api/api-client.js';
import { can } from '../access/access-session.js';

const h = React.createElement;
const { useEffect, useState } = React;

const dateLabel = value => value
    ? new Date(value).toLocaleString('en-GB')
    : 'Not recorded';

function fileSize(bytes) {
    const value = Number(bytes || 0);
    return value >= 1024 * 1024
        ? `${(value / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.ceil(value / 1024))} KB`;
}

export function PlanSupportingDocumentsPanel() {
    const [plans, setPlans] = useState([]);
    const [planId, setPlanId] = useState('');
    const [plansLoading, setPlansLoading] = useState(true);
    const [plansError, setPlansError] = useState('');
    const [plansAttempt, setPlansAttempt] = useState(0);

    const [rows, setRows] = useState([]);
    const [meta, setMeta] = useState({});
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [downloading, setDownloading] = useState(null);

    useEffect(() => {
        let active = true;

        async function loadPlans() {
            setPlansLoading(true);
            setPlansError('');

            try {
                const collected = [];
                let currentPage = 1;
                let lastPage = 1;

                do {
                    const query = new URLSearchParams({
                        level: 'strategic_plan',
                        per_page: '100',
                        page: String(currentPage),
                    });
                    const result = await apiRequest(`/api/strategic-plans?${query}`);

                    if (!active) return;

                    collected.push(...result.data);
                    lastPage = Number(result.meta?.last_page || 1);
                    currentPage += 1;
                } while (currentPage <= lastPage);

                setPlans(collected);
            } catch (err) {
                if (active) setPlansError(err.message);
            } finally {
                if (active) setPlansLoading(false);
            }
        }

        loadPlans();
        return () => { active = false; };
    }, [plansAttempt]);

    useEffect(() => {
        let active = true;

        setRows([]);
        setMeta({});
        setError('');

        

        setLoading(true);

        const query = new URLSearchParams({
    page: String(page),
    per_page: '25',
});

if (planId) query.set('plan_id', planId);

apiRequest(`/api/strategic-documents?${query}`)
            .then(result => {
                if (!active) return;
                setRows(result.data);
                setMeta(result.meta);
            })
            .catch(err => {
                if (active) setError(err.message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => { active = false; };
    }, [planId, page, attempt]);

    async function download(document) {
        if (downloading !== null || !can('strategic_documents.download')) return;

        setDownloading(document.document_id);
        setError('');

        try {
            const response = await fetch(
                `/api/strategic-documents/${document.document_id}/download`,
                { credentials: 'include' }
            );

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.message || 'The document could not be downloaded.');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = window.document.createElement('a');

            link.href = url;
            link.download = document.original_filename;
            window.document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (err) {
            setError(err.message);
        } finally {
            setDownloading(null);
        }
    }

    const selectedPlan = plans.find(
        plan => String(plan.record_id) === String(planId)
    );

    const button = (text, onClick, disabled = false) => h('button', {
        type: 'button',
        className: 'ui-button ui-button--secondary ui-button--sm',
        onClick,
        disabled,
    }, text);

    return h('section', {
        className: 'consolidate-register',
        'aria-label': 'Plan supporting documents',
        'aria-busy': plansLoading || loading,
    },
        h('header', { className: 'ui-section-header' },
            h('div', { className: 'ui-section-header__copy' },
                h('h2', null,
                    h('i', {
                        className: 'bi bi-folder2-open',
                        'aria-hidden': true,
                    }),
                    ' Supporting Documents'
                ),
                h('p', null,
                    'View files uploaded against an authorised plan. Documents provide supporting material and do not require an input-review decision.'
                )
            )
        ),

        h('div', { className: 'consolidate-filters' },
            h('label', null,
                h('span', null, 'Strategic plan'),
                h('select', {
                    value: planId,
                    disabled: plansLoading,
                    onChange: event => {
                        setRows([]);
                        setMeta({});
                        setError('');
                        setPage(1);
                        setPlanId(event.target.value);
                    },
                },
                    h('option', { value: '' },
    plansLoading ? 'Loading plans…' : 'All authorised plans'
),
                    plans.map(plan => h('option', {
                        key: plan.record_id,
                        value: String(plan.record_id),
                    }, `${String(plan.record_id).padStart(3, '0')} · ${plan.title}`))
                )
            ),
            button('Refresh documents', () => setAttempt(value => value + 1),
                loading || downloading !== null)
        ),

        plansError && h('p', {
            className: 'ui-status ui-status--error',
            role: 'alert',
        }, plansError, ' ',
            button('Retry plan list', () => setPlansAttempt(value => value + 1))
        ),

        error && h('p', {
            className: 'ui-status ui-status--error',
            role: 'alert',
        }, error),

        
        h(React.Fragment, null,
            h('p', { className: 'ui-help' },
                selectedPlan?.title || 'All authorised plans',
                ' · ',
                loading ? 'Loading documents…' : `${meta.total || 0} document(s)`
            ),

            h('div', { className: 'ui-table-wrap' },
                h('table', { className: 'ui-table' },
                    h('thead', null, h('tr', null,
                        ['Document', 'Strategic plan', 'Uploaded by', 'Classification', 'Uploaded at', 'Action']
                            .map(label => h('th', {
                                key: label,
                                scope: 'col',
                            }, label))
                    )),
                    h('tbody', null,
                        loading
                            ? h('tr', null, h('td', {
                                colSpan: 6,
                                className: 'consolidate-empty',
                            }, 'Loading supporting documents…'))
                            : rows.length
                                ? rows.map(document => h('tr', {
                                    key: document.document_id,
                                },
                                    h('td', null,
                                        h('strong', null, document.original_filename),
                                        h('small', null,
                                            `${String(document.extension || 'file').toUpperCase()} · ${fileSize(document.size_bytes)}`
                                        )
                                    ),
                                    h('td', null,
    document.plan?.title || 'Plan unavailable',
    h('small', null,
        `Plan ${String(document.strategic_plan_id).padStart(3, '0')}`
    )
),
                                    h('td', null,
                                        document.uploader?.name || 'Uploader unavailable',
                                        h('small', null, document.uploader?.office || 'Office not recorded')
                                    ),
                                    h('td', null,
                                        document.reference_level,
                                        h('small', null, document.content_category)
                                    ),
                                    h('td', null, dateLabel(document.created_at)),
                                    h('td', null,
                                        can('strategic_documents.download')
                                            ? button(
                                                downloading === document.document_id
                                                    ? 'Downloading…'
                                                    : 'Download',
                                                () => download(document),
                                                downloading !== null
                                            )
                                            : h('small', null, 'Download permission required')
                                    )
                                ))
                                : h('tr', null, h('td', {
                                    colSpan: 6,
                                    className: 'consolidate-empty',
                                }, error
                                    ? 'Documents could not be loaded.'
                                    : 'No supporting documents have been uploaded for this plan.'
                                ))
                    )
                )
            ),

            h('footer', { className: 'ui-pagination consolidate-pagination' },
                h('span', null, `Page ${page} of ${meta.last_page || 1}`),
                h('div', { className: 'ui-pagination__actions' },
                    button('Previous', () => setPage(value => value - 1),
                        loading || page <= 1),
                    button('Next', () => setPage(value => value + 1),
                        loading || page >= Number(meta.last_page || 1))
                )
            )
        )
    );
}