import { AppSidebar } from '../components/AppSidebar.js';
import { PageHeader } from '../components/PageHeader.js';
import { getStrategicPlan } from '../api/strategic-plans-api.js';
import { enforcePageAccess } from '../access/access-guard.js';
import { getAccessSession } from '../access/access-session.js';
import {
    listAssignedPlanSubmissions,
} from '../data/plan-approval-demo-data.js';

enforcePageAccess();

const h = React.createElement;
const { useEffect, useMemo, useState } = React;

function formatDate(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return '—';
    }

    return date.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
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

function stageOptions(reviews) {
    return [
        ...new Set(
            reviews
                .map(
                    (review) =>
                        review.submission.currentStage?.name
                )
                .filter(Boolean)
        ),
    ];
}

function StrategicPlanReviewsApp() {
    const session = getAccessSession();

    const [reviews, setReviews] = useState([]);
    const [search, setSearch] = useState('');
    const [stage, setStage] = useState('');
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState({
        type: '',
        message: '',
    });

    useEffect(() => {
        let active = true;

        async function loadAssignedReviews() {
            setLoading(true);
            setNotice({
                type: '',
                message: '',
            });

            try {
                const submissions =
                    listAssignedPlanSubmissions(session);

                const reviewResults = await Promise.all(
                    submissions.map(async (submission) => {
                        try {
                            const planPayload =
                                await getStrategicPlan(
                                    submission.planId
                                );

                            return {
                                submission,
                                plan: planPayload.data,
                                error: '',
                            };
                        } catch (error) {
                            return {
                                submission,
                                plan: null,
                                error:
                                    error.message ||
                                    'The Strategic Plan could not be loaded.',
                            };
                        }
                    })
                );

                if (!active) {
                    return;
                }

                setReviews(reviewResults);

                const inaccessibleReviews =
                    reviewResults.filter(
                        (review) => !review.plan
                    ).length;

                if (inaccessibleReviews > 0) {
                    setNotice({
                        type: 'error',
                        message:
                            `${inaccessibleReviews} assigned review(s) ` +
                            'could not be loaded. Please contact the system administrator.',
                    });
                }
            } catch (error) {
                if (!active) {
                    return;
                }

                setNotice({
                    type: 'error',
                    message:
                        error.message ||
                        'Assigned Strategic Plan reviews could not be loaded.',
                });
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadAssignedReviews();

        return () => {
            active = false;
        };
    }, []);

    const availableStages = useMemo(
        () => stageOptions(reviews),
        [reviews]
    );

    const filteredReviews = useMemo(() => {
        const normalizedSearch =
            search.trim().toLowerCase();

        return reviews.filter((review) => {
            const planTitle =
                review.plan?.title?.toLowerCase() || '';

            const planId = String(
                review.submission.planId || ''
            );

            const stageName =
                review.submission.currentStage?.name || '';

            const matchesSearch =
                !normalizedSearch ||
                planTitle.includes(normalizedSearch) ||
                planId.includes(normalizedSearch);

            const matchesStage =
                !stage || stageName === stage;

            return matchesSearch && matchesStage;
        });
    }, [reviews, search, stage]);

    function clearFilters() {
        setSearch('');
        setStage('');
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

                h(PageHeader, {
                    className: 'plan-reviews-header',
                    section: 'Strategic Planning',
                    title: 'Assigned Plan Reviews',
                    subtitle:
                        'View Strategic Plans currently assigned to you in the approval workflow.',
                }),

                h(
                    'section',
                    {
                        className:
                            'ui-card plan-review-assignment-card',
                        'aria-label':
                            'Current reviewer information',
                    },

                    h(
                        'div',
                        {
                            className:
                                'plan-review-assignment-icon',
                            'aria-hidden': 'true',
                        },
                        h('i', {
                            className:
                                'bi bi-person-check-fill',
                        })
                    ),

                    h(
                        'div',
                        null,
                        h(
                            'small',
                            null,
                            'Signed in reviewer'
                        ),
                        h(
                            'strong',
                            null,
                            session?.name || 'Current user'
                        ),
                        h(
                            'span',
                            null,
                            [
                                session?.roleLabel ||
                                    session?.roleName,
                                session?.office ||
                                    session?.department,
                            ]
                                .filter(Boolean)
                                .join(' · ') ||
                                'Reviewer details unavailable'
                        )
                    )
                ),

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

                h(
                    'section',
                    {
                        className:
                            'ui-card plan-review-filter-card',
                        'aria-labelledby':
                            'plan-review-filter-title',
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
                                        'plan-review-filter-title',
                                },
                                'Find assigned reviews'
                            ),
                            h(
                                'p',
                                null,
                                'Search by plan title or filter by the current workflow stage.'
                            )
                        ),

                        h('i', {
                            className: 'bi bi-funnel',
                            'aria-hidden': 'true',
                        })
                    ),

                    h(
                        'div',
                        {
                            className: 'ui-card__body',
                        },

                        h(
                            'div',
                            {
                                className:
                                    'plan-review-filters',
                            },

                            h(
                                'label',
                                {
                                    className: 'ui-field',
                                },
                                h(
                                    'span',
                                    {
                                        className: 'ui-label',
                                    },
                                    'Plan title or ID'
                                ),
                                h('input', {
                                    className: 'ui-input',
                                    type: 'search',
                                    value: search,
                                    placeholder:
                                        'Search assigned plans',
                                    onChange: (event) =>
                                        setSearch(
                                            event.target.value
                                        ),
                                })
                            ),

                            h(
                                'label',
                                {
                                    className: 'ui-field',
                                },
                                h(
                                    'span',
                                    {
                                        className: 'ui-label',
                                    },
                                    'Current stage'
                                ),
                                h(
                                    'select',
                                    {
                                        className: 'ui-select',
                                        value: stage,
                                        onChange: (event) =>
                                            setStage(
                                                event.target.value
                                            ),
                                    },
                                    h(
                                        'option',
                                        {
                                            value: '',
                                        },
                                        'All assigned stages'
                                    ),
                                    availableStages.map(
                                        (stageName) =>
                                            h(
                                                'option',
                                                {
                                                    value: stageName,
                                                    key: stageName,
                                                },
                                                stageName
                                            )
                                    )
                                )
                            ),

                            h(
                                'button',
                                {
                                    className:
                                        'ui-button ui-button--secondary ui-button--sm',
                                    type: 'button',
                                    disabled:
                                        !search && !stage,
                                    onClick: clearFilters,
                                },
                                'Clear'
                            )
                        )
                    )
                ),

                h(
                    'section',
                    {
                        className:
                            'ui-card plan-review-list-card',
                        'aria-labelledby':
                            'assigned-reviews-title',
                    },

                    h(
                        'div',
                        {
                            className:
                                'plan-review-table-heading',
                        },

                        h(
                            'div',
                            null,
                            h(
                                'h2',
                                {
                                    id:
                                        'assigned-reviews-title',
                                },
                                'Strategic Plans for Review'
                            ),
                            h(
                                'p',
                                null,
                                loading
                                    ? 'Loading assigned reviews…'
                                    : `${filteredReviews.length} assigned review(s)`
                            )
                        )
                    ),

                    loading
                        ? h(
                            'div',
                            {
                                className:
                                    'ui-card__body ui-empty',
                                role: 'status',
                            },
                            'Loading assigned Strategic Plan reviews…'
                        )
                        : filteredReviews.length === 0
                            ? h(
                                'div',
                                {
                                    className:
                                        'ui-card__body plan-review-empty',
                                },
                                h('i', {
                                    className:
                                        'bi bi-clipboard2-check',
                                    'aria-hidden': 'true',
                                }),
                                h(
                                    'h3',
                                    null,
                                    reviews.length === 0
                                        ? 'No plans are currently assigned to you'
                                        : 'No assigned reviews match the filters'
                                ),
                                h(
                                    'p',
                                    null,
                                    reviews.length === 0
                                        ? 'Submitted plans will appear here when the active workflow reaches a stage assigned to you.'
                                        : 'Change or clear the filters to view other assigned reviews.'
                                )
                            )
                            : h(
                                'div',
                                {
                                    className:
                                        'ui-table-wrap',
                                },

                                h(
                                    'table',
                                    {
                                        className:
                                            'ui-table plan-review-table',
                                    },

                                    h(
                                        'thead',
                                        null,
                                        h(
                                            'tr',
                                            null,
                                            [
                                                'Plan ID',
                                                'Plan Title',
                                                'Submitted By',
                                                'Submitted',
                                                'Current Stage',
                                                'Assigned Reviewer',
                                                'Status',
                                                'Action',
                                            ].map((heading) =>
                                                h(
                                                    'th',
                                                    {
                                                        key: heading,
                                                    },
                                                    heading
                                                )
                                            )
                                        )
                                    ),

                                    h(
                                        'tbody',
                                        null,
                                        filteredReviews.map(
                                            ({
                                                plan,
                                                submission,
                                                error,
                                            }) =>
                                                h(
                                                    'tr',
                                                    {
                                                        key:
                                                            submission.planId,
                                                    },

                                                    h(
                                                        'td',
                                                        null,
                                                        h(
                                                            'span',
                                                            {
                                                                className:
                                                                    'plan-review-id',
                                                            },
                                                            String(
                                                                submission.planId
                                                            ).padStart(
                                                                4,
                                                                '0'
                                                            )
                                                        )
                                                    ),

                                                    h(
                                                        'td',
                                                        null,
                                                        h(
                                                            'strong',
                                                            null,
                                                            plan?.title ||
                                                                'Plan unavailable'
                                                        ),
                                                        error
                                                            ? h(
                                                                'small',
                                                                {
                                                                    className:
                                                                        'plan-review-row-error',
                                                                },
                                                                error
                                                            )
                                                            : null
                                                    ),

                                                    h(
                                                        'td',
                                                        null,
                                                        creatorName(
                                                            plan?.creator
                                                        )
                                                    ),

                                                    h(
                                                        'td',
                                                        null,
                                                        formatDate(
                                                            submission.submittedAt
                                                        )
                                                    ),

                                                    h(
                                                        'td',
                                                        null,
                                                        h(
                                                            'strong',
                                                            {
                                                                className:
                                                                    'plan-review-stage-name',
                                                            },
                                                            submission
                                                                .currentStage
                                                                ?.name ||
                                                                '—'
                                                        ),
                                                        h(
                                                            'small',
                                                            {
                                                                className:
                                                                    'plan-review-stage-sequence',
                                                            },
                                                            submission
                                                                .currentStage
                                                                ?.sequence
                                                                ? `Stage ${submission.currentStage.sequence}`
                                                                : ''
                                                        )
                                                    ),

                                                    h(
                                                        'td',
                                                        null,
                                                        submission
                                                            .currentStage
                                                            ?.approver ||
                                                            '—'
                                                    ),

                                                    h(
                                                        'td',
                                                        null,
                                                        h(
                                                            'span',
                                                            {
                                                                className:
                                                                    'ui-badge plan-review-status',
                                                            },
                                                            'Pending Review'
                                                        )
                                                    ),

                                                    h(
                                                        'td',
                                                        {
                                                            className:
                                                                'plan-review-action-cell',
                                                        },
                                                        plan
                                                            ? h(
                                                                'a',
                                                                {
                                                                    className:
                                                                        'ui-button ui-button--primary ui-button--sm',
                                                                    href:
                                                                        `/strategic-plan-reviews/${submission.planId}`,
                                                                    'aria-label':
                                                                        `Review ${plan.title}`,
                                                                },
                                                                h(
                                                                    'i',
                                                                    {
                                                                        className:
                                                                            'bi bi-eye',
                                                                        'aria-hidden':
                                                                            'true',
                                                                    }
                                                                ),
                                                                'Review Plan'
                                                            )
                                                            : h(
                                                                'span',
                                                                {
                                                                    className:
                                                                        'ui-help',
                                                                },
                                                                'Unavailable'
                                                            )
                                                    )
                                                )
                                        )
                                    )
                                )
                            )
                )
            )
        )
    );
}

ReactDOM.createRoot(
    document.getElementById('root')
).render(
    h(StrategicPlanReviewsApp)
);