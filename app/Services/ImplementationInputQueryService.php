<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\ImplementationInput;
use App\Models\StrategicObjective;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ImplementationInputQueryService
{
    public function __construct(
        private readonly ImplementationInputAccessService $access,
        private readonly StrategicLogWriter $logWriter,
    ) {}

    private function scopedQuery(User $actor): Builder
    {
        $plans = $this->access->plans($actor)->select('record_id');
        $query = ImplementationInput::whereIn('strategic_plan_id', $plans)
            ->where(fn (Builder $q) => $q->whereNull('objective_id')
                ->orWhereHas('objective', fn (Builder $q) => $q->where('status', '!=', 'deleted')));
        if (! $this->access->viewsPlanningScope($actor)) {
            $unitId = $this->access->office($actor)->responsible_unit_id;
            $query->where('responsible_unit_id', $unitId)
                ->where(fn (Builder $q) => $q->whereNull('objective_id')
                    ->orWhereHas('objective.responsibleUnitAssignment', fn (Builder $q) => $q->where('responsible_unit_id', $unitId)));
        }

        return $query;
    }

    public function listing(array $filters, User $actor): array
    {
        $query = $this->scopedQuery($actor);
        if (! empty($filters['plan_id'])) {
            $this->access->ensurePlan((int) $filters['plan_id'], $actor);
            $query->where('strategic_plan_id', $filters['plan_id']);
        }
        if (! empty($filters['objective_id'])) {
            $objective = StrategicObjective::where('status', '!=', 'deleted')->findOrFail($filters['objective_id']);
            $this->access->ensurePlan((int) $objective->strategic_plan_id, $actor);
            if (! empty($filters['plan_id']) && (int) $filters['plan_id'] !== (int) $objective->strategic_plan_id) {
                throw ValidationException::withMessages(['objective_id' => ['The objective must belong to the selected strategic plan.']]);
            }
            if (! $this->access->viewsPlanningScope($actor)) {
                abort_unless($objective->responsibleUnitAssignment?->responsible_unit_id === $this->access->office($actor)->responsible_unit_id,
                    403, 'This objective is outside your Office/Agency scope.');
            }
            $query->where('objective_id', $objective->objective_id);
        }

        // Options originate from the authorized query, before user-selected filters.
        $options = [
            'plans' => $this->access->plans($actor)->orderBy('record_id')->get(['record_id', 'title']),
            'offices' => (clone $query)->select('responsible_unit_id', 'responsible_office_agency')->distinct()
                ->orderBy('responsible_office_agency')->get(),
        ];
        if (! empty($filters['responsible_unit_id'])) {
            $unitId = (int) $filters['responsible_unit_id'];
            $allowed = $this->access->viewsPlanningScope($actor)
                ? $options['offices']->contains('responsible_unit_id', $unitId)
                : $this->access->office($actor)->responsible_unit_id === $unitId;
            abort_unless($allowed, 403, 'This Office/Agency is outside your authorized input scope.');
            $query->where('responsible_unit_id', $unitId);
        }
        if (! empty($filters['input_type'])) {
            $query->where('input_type', $filters['input_type']);
        }
        if (! empty($filters['submitted_from'])) {
            $query->whereDate('submitted_at', '>=', $filters['submitted_from']);
        }
        if (! empty($filters['submitted_to'])) {
            $query->whereDate('submitted_at', '<=', $filters['submitted_to']);
        }
        // Summary follows every filter except status, and is independent of pagination.
        $counts = (clone $query)->selectRaw('review_status, COUNT(*) AS count')->groupBy('review_status')->pluck('count', 'review_status');
        $summary = array_fill_keys(ImplementationInput::STATUSES, 0);
        foreach ($counts as $status => $count) {
            $summary[$status] = (int) $count;
        }
        if (! empty($filters['status'])) {
            $query->where('review_status', $filters['status']);
        }
        $page = $query->with($this->relations())->orderBy('input_id')->paginate($filters['per_page'] ?? 25);

        return ['success' => true, 'data' => $page->getCollection()->map(fn ($input) => $this->present($input, $actor)), 'meta' => [
            'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(), 'total' => $page->total(),
            'summary' => $summary, 'filters' => $options,
        ]];
    }

    public function show(int $id, User $actor): array
    {
        $this->access->ensureCanView($actor);
        $input = ImplementationInput::findOrFail($id);
        $this->access->ensurePlan((int) $input->strategic_plan_id, $actor);
        abort_unless($this->scopedQuery($actor)->whereKey($id)->exists(), 403, 'This input is outside your authorized scope.');

        return $this->present($input->load($this->relations()), $actor);
    }

    public function review(int $id, array $data, User $actor): array
    {
        abort_unless($this->access->canReview($actor), 403, 'Only authorized Planning Officers may review inputs.');

        return DB::transaction(function () use ($id, $data, $actor) {
            $this->show($id, $actor);
            $input = ImplementationInput::whereKey($id)->lockForUpdate()->firstOrFail();
            // Serialize scope revocation with a review using that grant.
            abort_unless(DB::table('tblimplementation_input_scopes')->where('strategic_plan_id', $input->strategic_plan_id)
                ->where('user_id', $actor->user_id)->lockForUpdate()->first(), 403, 'Your planning scope was revoked.');
            $plan = $input->strategicPlan()->lockForUpdate()->firstOrFail();
            $objective = $input->objective_id === null ? null : $input->objective()->lockForUpdate()->firstOrFail();
            abort_unless($this->isReviewable($input, $plan->status, $objective?->status), 409, 'This input is no longer available for review.');
            $input->forceFill([
                'review_status' => $data['status'], 'review_note' => $data['review_note'] ?? null,
                'reviewed_by' => $actor->user_id, 'reviewer_name' => $actor->name, 'reviewed_at' => now(),
            ])->save();
            $this->logWriter->write('implementation_input.reviewed', [
                'resource_type' => 'implementation_input', 'resource_id' => $id,
                'actor_user_id' => $actor->user_id, 'strategic_plan_id' => $input->strategic_plan_id,
                'from' => ImplementationInput::PENDING_REVIEW, 'to' => $data['status'],
            ]);

            return $this->present($input->load($this->relations()), $actor);
        }, 3);
    }

    private function relations(): array
    {
        return ['strategicPlan:record_id,title,status', 'objective:objective_id,objective_title,status'];
    }

    private function present(ImplementationInput $input, User $actor): array
    {
        return [...$input->toArray(), 'can_review' => $this->access->canReview($actor)
            && $this->isReviewable($input, $input->strategicPlan->status, $input->objective?->status)];
    }

    private function isReviewable(ImplementationInput $input, string $planStatus, ?string $objectiveStatus): bool
    {
        return $input->review_status === ImplementationInput::PENDING_REVIEW
            && in_array($planStatus, ['draft', 'finished'], true)
            && ($input->objective_id === null || in_array($objectiveStatus, ['draft', 'published'], true));
    }
}
