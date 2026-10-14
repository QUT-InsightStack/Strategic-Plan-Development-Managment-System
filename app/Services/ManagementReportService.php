<?php

namespace App\Services;

use App\Models\PlanWorkflowHistory;
use App\Models\Strategic;
use App\Models\StrategicObjective;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Builds the Management report master. The backend decides which sections a user receives
 * and which rows they contain; sections without permission are omitted and listed on the cover.
 * Calculations mirror the Management dashboard (management-insights.js) so figures agree.
 */
class ManagementReportService
{
    public const SECTIONS = [
        'cover' => ['number' => 0, 'title' => 'Report Information', 'permissions' => []],
        'summary' => ['number' => 1, 'title' => 'Executive Summary', 'permissions' => ['strategic_records.view']],
        'plans' => ['number' => 2, 'title' => 'Plan Status', 'permissions' => ['strategic_records.view']],
        'progress' => ['number' => 3, 'title' => 'Objective Progress', 'permissions' => ['strategic_objectives.view']],
        'alignment' => ['number' => 4, 'title' => 'Strategic Alignment', 'permissions' => ['strategic_objectives.view']],
        'offices' => ['number' => 5, 'title' => 'Office / Unit Performance', 'permissions' => ['strategic_objectives.view']],
        'inputs' => ['number' => 6, 'title' => 'Inputs & Consolidation', 'permissions' => ['implementation_inputs.view', 'implementation_inputs.view_all']],
        'approvals' => ['number' => 7, 'title' => 'Approvals', 'permissions' => ['strategic_records.view']],
        'overdue' => ['number' => 8, 'title' => 'Overdue Items', 'permissions' => ['strategic_objectives.view']],
        'annex' => ['number' => 9, 'title' => 'Annex: Definitions', 'permissions' => []],
    ];

    public const APPROVAL_LABELS = [
        'not_submitted' => 'Not submitted', 'under_approval' => 'Awaiting approval',
        'approved' => 'Approved', 'rejected' => 'Returned for correction',
    ];

    private const PROGRESS_LABELS = ['completed' => 'Completed', 'in_progress' => 'Ongoing', 'not_started' => 'Not Started', 'overdue' => 'Overdue / Delayed'];

    private const INPUT_LABELS = ['Pending Review' => 'Pending review', 'Approved' => 'Accepted', 'Rejected' => 'Declined'];

    public function __construct(
        private readonly StrategicPlanAuthorizationService $plans,
        private readonly PermissionAuthorizationService $permissions,
        private readonly ImplementationInputQueryService $inputs,
        private readonly PlanReadinessService $readiness,
    ) {}

    public function build(User $user, array $filters, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $filters = $this->normaliseFilters($filters);
        $allowed = collect(self::SECTIONS)->map(fn (array $section) => $this->canAny($user, $section['permissions']));
        $omitted = [];

        $plans = $allowed['plans'] ? $this->loadPlans($user) : collect();
        $objectives = $this->can($user, 'strategic_objectives.view') ? $this->loadObjectives($user) : collect();
        $inputs = collect();
        if ($allowed['inputs']) {
            try {
                $inputs = $this->inputs->reportInputs($user);
            } catch (HttpException) {
                $allowed['inputs'] = false;
                $omitted[] = $this->omission('inputs', 'Your account has no input scope (for example, no active Office / Unit membership).');
            }
        }

        // Shared scope, as filterManagementRows() on the dashboard.
        $selectedPlans = $plans->filter(fn (Strategic $plan) => $this->planMatches($plan, $filters))->values();
        $selectedIds = $selectedPlans->pluck('record_id')->map(fn ($id) => (int) $id)->flip();
        $plansById = $selectedPlans->keyBy('record_id');
        $filteredObjectives = $objectives->filter(fn (StrategicObjective $objective) => $selectedIds->has((int) $objective->strategic_plan_id)
            && (! $filters['office'] || $this->officeName($objective) === $filters['office'])
            && (! $filters['objective_status'] || ($filters['objective_status'] === 'overdue'
                ? $this->isOverdue($objective, $plansById->get($objective->strategic_plan_id), $now)
                : $this->progressStatus($objective) === $filters['objective_status'])))->values();
        if ($filters['office'] || $filters['objective_status']) {
            $visibleIds = $filteredObjectives->pluck('strategic_plan_id')->map(fn ($id) => (int) $id)->flip();
            if ($filters['office'] && ! $filters['objective_status']) {
                $selectedPlans->where('department_agency', $filters['office'])->each(function ($plan) use (&$visibleIds) { $visibleIds[(int) $plan->record_id] = true; });
                $inputs->filter(fn ($input) => $input->responsible_office_agency === $filters['office'] && $selectedIds->has((int) $input->strategic_plan_id))
                    ->each(function ($input) use (&$visibleIds) { $visibleIds[(int) $input->strategic_plan_id] = true; });
            }
        } else {
            $visibleIds = $selectedIds;
        }
        $filteredPlans = $selectedPlans->filter(fn ($plan) => $visibleIds->has((int) $plan->record_id))->values();
        $allowedPlanIds = $filteredPlans->pluck('record_id')->map(fn ($id) => (int) $id)->flip();
        $allowedObjectiveIds = $filteredObjectives->pluck('objective_id')->map(fn ($id) => (int) $id)->flip();
        $filteredInputs = $inputs->filter(fn ($input) => $allowedPlanIds->has((int) $input->strategic_plan_id)
            && (! $filters['office'] || $input->responsible_office_agency === $filters['office'])
            && (! $filters['objective_status'] || $allowedObjectiveIds->has((int) $input->objective_id)))->values();
        $approvedPlans = $filteredPlans->where('approval_status', 'approved')->keyBy('record_id');
        $execution = $filteredObjectives->filter(fn ($objective) => $approvedPlans->has($objective->strategic_plan_id))->values();
        $overdue = $execution->filter(fn ($objective) => $this->isOverdue($objective, $approvedPlans->get($objective->strategic_plan_id), $now))->values();

        $context = compact('user', 'filters', 'now', 'filteredPlans', 'filteredObjectives', 'filteredInputs', 'approvedPlans', 'execution', 'overdue', 'allowed');
        $sections = [];
        foreach (array_keys(self::SECTIONS) as $id) {
            if ($id === 'cover') {
                continue;
            }
            if (! $allowed[$id]) {
                if (! collect($omitted)->contains('id', $id)) {
                    $omitted[] = $this->omission($id, 'Requires '.implode(' or ', self::SECTIONS[$id]['permissions']).'.');
                }

                continue;
            }
            $sections[] = ['id' => $id, 'number' => self::SECTIONS[$id]['number'], 'title' => self::SECTIONS[$id]['title'], ...$this->{'section'.ucfirst($id)}($context)];
        }
        usort($omitted, fn ($a, $b) => $a['number'] <=> $b['number']);

        $meta = [
            'title' => 'Strategic Planning Management Report',
            'generated_at' => $now->toIso8601String(),
            'generated_by' => trim(($user->first_name ?? '').' '.($user->last_name ?? '')) ?: $user->email,
            'role' => $user->role?->role_name,
            'planning_period' => $filters['period'] ? str_replace('-', '–', $filters['period']) : 'All planning periods',
            'filters' => $this->filterLabels($filters, $plans),
            'scope' => $this->scopeStatement($user),
        ];
        $cover = ['id' => 'cover', 'number' => 0, 'title' => self::SECTIONS['cover']['title'], 'fields' => [
            ['label' => 'Report', 'value' => $meta['title']],
            ['label' => 'Planning period', 'value' => $meta['planning_period']],
            ['label' => 'Generated by', 'value' => $meta['generated_by'].($meta['role'] ? " ({$meta['role']})" : '')],
            ['label' => 'Generated at', 'value' => $now->format('j M Y, H:i T')],
            ['label' => 'Applied filters', 'value' => $meta['filters'] ? collect($meta['filters'])->map(fn ($f) => "{$f['label']}: {$f['value']}")->implode('; ') : 'None'],
            ['label' => 'Data scope', 'value' => $meta['scope']],
            ['label' => 'Sections omitted', 'value' => $omitted ? collect($omitted)->map(fn ($s) => "{$s['number']}. {$s['title']}")->implode('; ').' — omitted because of access permissions, not because they are empty.' : 'None'],
        ]];

        return ['meta' => $meta, 'sections' => [$cover, ...$sections], 'omitted_sections' => $omitted];
    }

    /** @return array{0: string, 1: array, 2: array} [title, columns, rows] */
    public function table(array $report, string $sectionId, ?string $tableId = null): ?array
    {
        $section = collect($report['sections'])->firstWhere('id', $sectionId);
        $tables = collect($section['tables'] ?? []);
        $table = $tableId ? $tables->firstWhere('id', $tableId) : $tables->first();

        return $table ? [$table['title'], $table['columns'], $table['rows']] : null;
    }

    public function isOmitted(array $report, string $sectionId): bool
    {
        return collect($report['omitted_sections'])->contains('id', $sectionId);
    }

    private function sectionSummary(array $c): array
    {
        $objectivesAllowed = $c['allowed']['progress'];
        $aligned = $c['filteredObjectives']->filter(fn ($o) => $this->isAligned($o))->count();
        $inputsTotal = $c['filteredInputs']->count();
        $reviewed = $c['filteredInputs']->whereIn('review_status', ['Approved', 'Rejected'])->count();
        $completed = $c['execution']->filter(fn ($o) => $this->progressStatus($o) === 'completed')->count();
        $ongoing = $c['execution']->filter(fn ($o) => $this->progressStatus($o) === 'in_progress')->count();
        $byStatus = $c['filteredPlans']->groupBy(fn ($p) => $p->planning_status_label ?: $p->status)->map->count()->sortDesc();
        $kpis = [
            ['key' => 'plans', 'label' => 'Strategic Plans', 'value' => $c['filteredPlans']->count(), 'detail' => $byStatus->map(fn ($n, $label) => "{$label}: {$n}")->implode(' · ') ?: 'In your authorised scope', 'available' => true],
            ['key' => 'objective_progress', 'label' => 'Objective Progress', 'value' => "{$completed} / {$c['execution']->count()}", 'detail' => "Completed · {$ongoing} ongoing (approved plans)", 'available' => $objectivesAllowed],
            ['key' => 'alignment', 'label' => 'Alignment Coverage', 'value' => $this->percent($aligned, $c['filteredObjectives']->count()).'%', 'detail' => "{$aligned} of {$c['filteredObjectives']->count()} linked to Agenda and PDP", 'available' => $objectivesAllowed],
            ['key' => 'inputs', 'label' => 'Inputs & Consolidation', 'value' => $this->percent($reviewed, $inputsTotal).'%', 'detail' => 'Reviewed · '.$c['filteredInputs']->where('review_status', 'Pending Review')->count().' pending', 'available' => $c['allowed']['inputs']],
            ['key' => 'awaiting', 'label' => 'Awaiting Approval', 'value' => $c['filteredPlans']->where('approval_status', 'under_approval')->count(), 'detail' => 'Plans under approval', 'available' => true],
            ['key' => 'overdue', 'label' => 'Overdue / Delayed', 'value' => $c['overdue']->count(), 'detail' => 'Incomplete after plan end date', 'available' => $objectivesAllowed],
        ];
        $kpis = array_map(fn ($kpi) => $kpi['available'] ? $kpi : [...$kpi, 'value' => null, 'detail' => 'No access'], $kpis);

        return ['description' => 'Headline figures for the filtered scope; they match the Management Dashboard cards.', 'kpis' => $kpis, 'tables' => [[
            'id' => 'kpis', 'title' => 'Executive summary', 'columns' => $this->columns(['indicator' => 'Indicator', 'value' => 'Value', 'detail' => 'Detail']),
            'rows' => array_map(fn ($kpi) => ['indicator' => $kpi['label'], 'value' => $kpi['value'] ?? 'No access', 'detail' => $kpi['detail']], $kpis),
        ]]];
    }

    private function sectionPlans(array $c): array
    {
        return ['description' => 'Plan register with lifecycle and approval status.', 'tables' => [[
            'id' => 'plans', 'title' => 'Plan register',
            'columns' => $this->columns(['plan_id' => 'Plan ID', 'plan' => 'Strategic plan', 'office' => 'Department / Agency', 'planning_period' => 'Planning period', 'status' => 'Status', 'approval_status' => 'Approval status']),
            'rows' => $c['filteredPlans']->map(fn ($plan) => [
                'plan_id' => $plan->record_id, 'plan' => $plan->title, 'office' => $plan->department_agency ?? '',
                'planning_period' => $this->periodText($plan), 'status' => $plan->planning_status_label ?: $plan->status,
                'approval_status' => self::APPROVAL_LABELS[$plan->approval_status ?? 'not_submitted'] ?? $plan->approval_status,
            ])->values()->all(),
        ]]];
    }

    private function sectionProgress(array $c): array
    {
        $rows = $c['execution']->map(function ($objective) use ($c) {
            $plan = $c['approvedPlans']->get($objective->strategic_plan_id);

            return [
                'plan' => $plan?->title ?? '', 'pdp_chapter' => $this->chapterLabel($objective, ''), 'objective' => $objective->objective_title,
                'responsible_office' => $this->officeName($objective), 'progress_percent' => $this->progressPercent($objective),
                'status' => self::PROGRESS_LABELS[$this->progressStatus($objective)], 'overdue' => $this->isOverdue($objective, $plan, $c['now']) ? 'Yes' : 'No',
                'updated_at' => $objective->progress_updated_at?->toDateString() ?? '',
            ];
        })->sortBy([['plan', 'asc'], ['pdp_chapter', 'asc'], ['objective', 'asc']])->values()->all();

        return ['description' => 'Objectives in approved plans, grouped by plan and PDP chapter.', 'tables' => [[
            'id' => 'progress', 'title' => 'Objective progress', 'group_by' => 'plan',
            'columns' => $this->columns(['plan' => 'Strategic plan', 'pdp_chapter' => 'PDP chapter', 'objective' => 'Objective', 'responsible_office' => 'Responsible office', 'progress_percent' => 'Progress %', 'status' => 'Status', 'overdue' => 'Overdue', 'updated_at' => 'Last update']),
            'rows' => $rows,
        ]]];
    }

    private function sectionAlignment(array $c): array
    {
        $rows = $c['filteredObjectives']->map(function ($objective) {
            $agenda = $this->agendaLabel($objective);
            $chapter = $this->chapterLabel($objective);

            return [
                'plan' => $objective->strategicPlan?->title ?? '', 'presidential_agenda' => $agenda, 'pdp_chapter' => $chapter,
                'objective' => $objective->objective_title, 'agency' => $this->officeName($objective),
                'missing_links' => implode(', ', array_filter([$agenda === '—' ? 'Agenda' : null, $chapter === '—' ? 'PDP' : null])) ?: 'None',
            ];
        })->values()->all();
        $aligned = $c['filteredObjectives']->filter(fn ($o) => $this->isAligned($o))->count();

        return ['description' => "Presidential Agenda → PDP Chapter → DOST Strategic Objective → Agency Plan. {$aligned} of {$c['filteredObjectives']->count()} objectives are linked to both Agenda and PDP.", 'tables' => [[
            'id' => 'alignment', 'title' => 'Strategic alignment',
            'columns' => $this->columns(['plan' => 'Strategic plan', 'presidential_agenda' => 'Presidential Agenda', 'pdp_chapter' => 'PDP chapter', 'objective' => 'Objective', 'agency' => 'Responsible office', 'missing_links' => 'Missing links']),
            'rows' => $rows,
        ]]];
    }

    private function sectionOffices(array $c): array
    {
        $withInputs = $c['allowed']['inputs'];
        $groups = [];
        $row = function (string $name) use (&$groups): array {
            return $groups[$name] ?? ['office' => $name, 'objectives' => 0, 'completed' => 0, 'aligned' => 0, 'inputs_submitted' => 0, 'inputs_pending' => 0, 'overdue' => 0];
        };
        foreach ($c['execution'] as $objective) {
            $item = $row($name = $this->officeName($objective));
            $item['objectives']++;
            $item['completed'] += $this->progressStatus($objective) === 'completed' ? 1 : 0;
            $item['aligned'] += $this->isAligned($objective) ? 1 : 0;
            $item['overdue'] += $this->isOverdue($objective, $c['approvedPlans']->get($objective->strategic_plan_id), $c['now']) ? 1 : 0;
            $groups[$name] = $item;
        }
        if ($withInputs) {
            foreach ($c['filteredInputs'] as $input) {
                $item = $row($name = $input->responsible_office_agency ?: 'Unassigned');
                $item['inputs_submitted']++;
                $item['inputs_pending'] += $input->review_status === 'Pending Review' ? 1 : 0;
                $groups[$name] = $item;
            }
        }
        ksort($groups, SORT_NATURAL | SORT_FLAG_CASE);
        $columns = ['office' => 'Office / Unit', 'objectives' => 'Objectives', 'completion_percent' => 'Completion %', 'alignment_percent' => 'Alignment coverage %'];
        if ($withInputs) {
            $columns += ['inputs_submitted' => 'Inputs submitted', 'inputs_pending' => 'Inputs pending'];
        }
        $columns['overdue'] = 'Overdue';

        return ['description' => 'Objectives in approved plans by responsible Office / Unit.'.($withInputs ? '' : ' Input columns are omitted because you cannot view submitted inputs.'), 'tables' => [[
            'id' => 'offices', 'title' => 'Office / Unit performance', 'columns' => $this->columns($columns),
            'rows' => array_values(array_map(fn ($g) => array_intersect_key([
                ...$g, 'completion_percent' => $this->percent($g['completed'], $g['objectives']), 'alignment_percent' => $this->percent($g['aligned'], $g['objectives']),
            ], $columns), $groups)),
        ]]];
    }

    private function sectionInputs(array $c): array
    {
        $consolidation = $c['filteredInputs']->groupBy(fn ($input) => $input->responsible_office_agency ?: 'Unassigned')
            ->map(fn ($rows, $office) => [
                'office' => $office, 'total' => $rows->count(), 'pending' => $rows->where('review_status', 'Pending Review')->count(),
                'accepted' => $rows->where('review_status', 'Approved')->count(), 'declined' => $rows->where('review_status', 'Rejected')->count(),
                'reviewed_percent' => $this->percent($rows->whereIn('review_status', ['Approved', 'Rejected'])->count(), $rows->count()),
            ])->sortKeys(SORT_NATURAL | SORT_FLAG_CASE)->values()->all();

        return ['description' => 'Submitted Office / Agency inputs and their review status (read-only).', 'tables' => [
            ['id' => 'inputs', 'title' => 'Submitted inputs',
                'columns' => $this->columns(['plan' => 'Strategic plan', 'objective' => 'Related objective', 'office' => 'Office / Agency', 'category' => 'Category', 'status' => 'Review status', 'submitted_at' => 'Submitted', 'reviewed_at' => 'Reviewed']),
                'rows' => $c['filteredInputs']->map(fn ($input) => [
                    'plan' => $input->strategicPlan?->title ?? '', 'objective' => $input->objective?->objective_title ?? 'Plan-level input',
                    'office' => $input->responsible_office_agency ?? '', 'category' => str_replace('_', ' ', (string) ($input->feedback_category ?: $input->input_type)),
                    'status' => self::INPUT_LABELS[$input->review_status] ?? $input->review_status,
                    'submitted_at' => $input->submitted_at ? CarbonImmutable::parse($input->submitted_at)->toDateString() : '',
                    'reviewed_at' => $input->reviewed_at ? CarbonImmutable::parse($input->reviewed_at)->toDateString() : '',
                ])->values()->all()],
            ['id' => 'consolidation', 'title' => 'Consolidation by Office / Unit',
                'columns' => $this->columns(['office' => 'Office / Unit', 'total' => 'Total', 'pending' => 'Pending review', 'accepted' => 'Accepted', 'declined' => 'Declined', 'reviewed_percent' => 'Reviewed %']),
                'rows' => $consolidation],
        ]];
    }

    private function sectionApprovals(array $c): array
    {
        $tables = [[
            'id' => 'approvals', 'title' => 'Plan approval status',
            'columns' => $this->columns(['plan_id' => 'Plan ID', 'plan' => 'Strategic plan', 'office' => 'Department / Agency', 'approval_status' => 'Approval status']),
            'rows' => $c['filteredPlans']->filter(fn ($p) => in_array($p->approval_status, ['under_approval', 'approved', 'rejected'], true))->map(fn ($plan) => [
                'plan_id' => $plan->record_id, 'plan' => $plan->title, 'office' => $plan->department_agency ?? '',
                'approval_status' => self::APPROVAL_LABELS[$plan->approval_status],
            ])->values()->all(),
        ]];
        // Only workflow participants get their own decision history.
        if (PlanWorkflowHistory::where('actor_id', $c['user']->user_id)->exists()) {
            $titles = $c['filteredPlans']->pluck('title', 'record_id');
            $tables[] = [
                'id' => 'my_decisions', 'title' => 'My approval decisions',
                'columns' => $this->columns(['plan' => 'Strategic plan', 'stage' => 'Stage', 'decision' => 'Decision', 'comment' => 'Comment', 'decided_at' => 'Date']),
                'rows' => PlanWorkflowHistory::query()
                    ->join('plan_submissions', 'plan_submissions.id', '=', 'plan_workflow_history.submission_id')
                    ->leftJoin('plan_submission_stages', 'plan_submission_stages.id', '=', 'plan_workflow_history.stage_id')
                    ->where('plan_workflow_history.actor_id', $c['user']->user_id)
                    ->whereIn('plan_workflow_history.action', ['approved', 'rejected'])
                    ->whereIn('plan_submissions.plan_id', $titles->keys()->all())
                    ->orderByDesc('plan_workflow_history.created_at')
                    ->get(['plan_submissions.plan_id', 'plan_submission_stages.name as stage', 'plan_workflow_history.action', 'plan_workflow_history.comment', 'plan_workflow_history.created_at'])
                    ->map(fn ($event) => [
                        'plan' => $titles[$event->plan_id] ?? "Plan {$event->plan_id}", 'stage' => $event->stage ?? '',
                        'decision' => $event->action === 'approved' ? 'Approved' : 'Returned for correction',
                        'comment' => $event->comment ?? '', 'decided_at' => CarbonImmutable::parse($event->created_at)->toDateString(),
                    ])->values()->all(),
            ];
        }
        $counts = collect(self::APPROVAL_LABELS)->map(fn ($label, $status) => "{$label}: ".$c['filteredPlans']->filter(fn ($p) => ($p->approval_status ?? 'not_submitted') === $status)->count())->implode(' · ');

        return ['description' => "{$counts}. Returned for correction is the existing rejected status; the plan can be corrected and resubmitted.", 'tables' => $tables];
    }

    private function sectionOverdue(array $c): array
    {
        return ['description' => 'Incomplete objectives in approved plans after their plan end date. Objective deadlines are not recorded, so the plan end date is used.', 'tables' => [[
            'id' => 'overdue', 'title' => 'Overdue items',
            'columns' => $this->columns(['plan' => 'Strategic plan', 'objective' => 'Objective', 'office' => 'Responsible office', 'progress_percent' => 'Progress %', 'planning_end_date' => 'Plan end date']),
            'rows' => $c['overdue']->map(fn ($objective) => [
                'plan' => $c['approvedPlans']->get($objective->strategic_plan_id)?->title ?? '', 'objective' => $objective->objective_title,
                'office' => $this->officeName($objective), 'progress_percent' => $this->progressPercent($objective),
                'planning_end_date' => $c['approvedPlans']->get($objective->strategic_plan_id)?->planning_end_date?->toDateString() ?? '',
            ])->values()->all(),
        ]]];
    }

    private function sectionAnnex(array $c): array
    {
        return ['description' => 'Definitions used throughout this report.', 'definitions' => [
            ['term' => 'Objective status', 'definition' => 'Not Started = 0% progress; Ongoing = 1–99%; Completed = 100%. Progress comes from the latest recorded progress update.'],
            ['term' => 'Overdue / Delayed', 'definition' => 'An objective that is not completed after its plan end date. No separate at-risk threshold is defined.'],
            ['term' => 'Alignment coverage', 'definition' => 'Objectives linked to both a Presidential Agenda item and a PDP chapter, divided by all non-archived objectives in scope.'],
            ['term' => 'Returned for correction', 'definition' => 'The existing rejected approval status. The submitting team can correct and resubmit the plan.'],
            ['term' => 'Awaiting approval', 'definition' => 'Plans whose approval status is under approval.'],
            ['term' => 'Input review status', 'definition' => 'Pending review, Accepted (approved) or Declined (rejected). Accepting an input does not change the plan automatically.'],
            ['term' => 'Execution figures', 'definition' => 'Objective progress, overdue items and Office / Unit performance cover objectives in approved plans.'],
            ['term' => 'Data scope', 'definition' => 'Only records your account is authorised to see are included. Sections you cannot access are omitted and listed on the cover.'],
        ]];
    }

    private function loadPlans(User $user): Collection
    {
        $ids = $this->plans->authorizedPlanIdsForListing($user, ['archived', 'deleted']);

        return Strategic::with(['objectives', 'inputs', 'missionFoundation', 'visionFoundation', 'coreValues'])
            ->whereIn('record_id', $ids->all())->whereIn('status', ['draft', 'finished'])->orderBy('record_id')->get()
            ->map(fn (Strategic $plan) => $this->readiness->describe($plan));
    }

    private function loadObjectives(User $user): Collection
    {
        $query = StrategicObjective::with(['pdpChapters', 'presidentialAgendaItems', 'responsibleUnitAssignment.responsibleUnit', 'strategicPlan:record_id,title'])
            ->where('status', '!=', 'deleted')
            ->whereIn('strategic_plan_id', $this->plans->authorizedPlanIdsForListing($user, ['deleted'])->all())
            ->whereHas('strategicPlan', fn ($plan) => $plan->where('status', '!=', 'deleted'));
        $this->plans->scopeObjectivesForUser($query, $user);

        return $query->orderBy('objective_id')->get()->reject(fn ($objective) => $objective->status === 'archived')->values();
    }

    private function normaliseFilters(array $filters): array
    {
        [$kind, $value] = array_pad(explode(':', (string) ($filters['status'] ?? ''), 2), 2, '');

        return [
            'plan_id' => (string) ($filters['plan_id'] ?? ''), 'period' => (string) ($filters['period'] ?? ''), 'office' => (string) ($filters['office'] ?? ''),
            'plan_status' => $kind === 'plan' ? $value : '', 'objective_status' => $kind === 'objective' ? $value : '',
            'approval_status' => (string) ($filters['approval_status'] ?? ''),
        ];
    }

    private function planMatches(Strategic $plan, array $filters): bool
    {
        return (! $filters['plan_id'] || (string) $plan->record_id === $filters['plan_id'])
            && (! $filters['period'] || $this->periodKey($plan) === $filters['period'])
            && (! $filters['plan_status'] || $plan->status === $filters['plan_status'])
            && (! $filters['approval_status'] || ($plan->approval_status ?? 'not_submitted') === $filters['approval_status']);
    }

    public function periodKey(Strategic $plan): string
    {
        $start = (int) $plan->planning_start_date?->format('Y');
        $end = (int) $plan->planning_end_date?->format('Y');

        return $start >= 1900 && $end >= $start ? "{$start}-{$end}" : '';
    }

    private function periodText(Strategic $plan): string
    {
        return $plan->planning_start_date && $plan->planning_end_date
            ? $plan->planning_start_date->toDateString().' – '.$plan->planning_end_date->toDateString() : '';
    }

    private function filterLabels(array $filters, Collection $plans): array
    {
        $labels = [];
        if ($filters['plan_id']) {
            $labels[] = ['label' => 'Strategic plan', 'value' => $plans->firstWhere('record_id', (int) $filters['plan_id'])?->title ?? "Plan {$filters['plan_id']}"];
        }
        if ($filters['period']) {
            $labels[] = ['label' => 'Planning period', 'value' => str_replace('-', '–', $filters['period'])];
        }
        if ($filters['office']) {
            $labels[] = ['label' => 'Office / Unit', 'value' => $filters['office']];
        }
        if ($filters['plan_status']) {
            $labels[] = ['label' => 'Plan status', 'value' => $filters['plan_status'] === 'finished' ? 'Finalized' : ucfirst(str_replace('_', ' ', $filters['plan_status']))];
        }
        if ($filters['objective_status']) {
            $labels[] = ['label' => 'Objective status', 'value' => self::PROGRESS_LABELS[$filters['objective_status']] ?? $filters['objective_status']];
        }
        if ($filters['approval_status']) {
            $labels[] = ['label' => 'Approval status', 'value' => self::APPROVAL_LABELS[$filters['approval_status']] ?? $filters['approval_status']];
        }

        return $labels;
    }

    private function scopeStatement(User $user): string
    {
        $role = $user->role?->role_name;
        if (in_array($role, ['Planning Officer', 'Planner/Encoder'], true)) {
            return 'Plans you created.';
        }
        if (in_array($role, ['Office', 'Responsible Unit User', 'Office Representative', 'Office/Agency', 'Offices / Agencies'], true)) {
            return 'Objectives assigned to your Office / Unit'.($user->office ? " ({$user->office})" : '').'.';
        }

        return 'All authorised strategic plans.';
    }

    private function omission(string $id, string $reason): array
    {
        return ['id' => $id, 'number' => self::SECTIONS[$id]['number'], 'title' => self::SECTIONS[$id]['title'], 'reason' => $reason];
    }

    private function canAny(User $user, array $codes): bool
    {
        return $codes === [] || collect($codes)->contains(fn ($code) => $this->can($user, $code));
    }

    private function can(User $user, string $code): bool
    {
        return (bool) $user->role?->hasFullAccess() || $this->permissions->userPermissionCodes($user)->contains($code);
    }

    private function columns(array $columns): array
    {
        return collect($columns)->map(fn ($label, $key) => ['key' => $key, 'label' => $label])->values()->all();
    }

    private function percent(int $part, int $total): int
    {
        return $total ? (int) round($part * 100 / $total) : 0;
    }

    public function progressPercent(StrategicObjective $objective): int
    {
        return max(0, min(100, (int) $objective->progress_percentage));
    }

    public function progressStatus(StrategicObjective $objective): string
    {
        $status = $objective->progress_status;
        if (in_array($status, ['completed', 'in_progress', 'not_started'], true)) {
            return $status;
        }
        $percent = $this->progressPercent($objective);

        return $percent >= 100 ? 'completed' : ($percent > 0 ? 'in_progress' : 'not_started');
    }

    public function isOverdue(StrategicObjective $objective, ?Strategic $plan, CarbonImmutable $now): bool
    {
        return $this->progressStatus($objective) !== 'completed' && $plan?->planning_end_date
            && CarbonImmutable::parse($plan->planning_end_date->toDateString())->endOfDay()->lessThan($now);
    }

    private function isAligned(StrategicObjective $objective): bool
    {
        return $objective->presidentialAgendaItems->isNotEmpty() && $objective->pdpChapters->isNotEmpty();
    }

    public function officeName(StrategicObjective $objective): string
    {
        return $objective->responsibleUnitAssignment?->responsibleUnit?->responsible_office_agency
            ?: ($objective->responsible_office_agency ?: 'Unassigned');
    }

    private function agendaLabel(StrategicObjective $objective, string $empty = '—'): string
    {
        return $objective->presidentialAgendaItems->pluck('title')->filter()->implode(', ') ?: $empty;
    }

    private function chapterLabel(StrategicObjective $objective, string $empty = '—'): string
    {
        return $objective->pdpChapters->pluck('chapter_title')->filter()->implode(', ') ?: $empty;
    }
}
