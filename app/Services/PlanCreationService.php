<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\Link;
use App\Models\Relation;
use App\Models\Strategic;
use App\Models\StrategicFoundations;
use App\Models\StrategicObjective;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PlanCreationService
{
    public function __construct(private readonly StrategicLogWriter $logWriter)
    {
    }

    public function paginate(array $filters, ?Collection $authorizedPlanIds = null): LengthAwarePaginator
    {
        $query = Strategic::with(['creator', 'missionFoundation', 'visionFoundation', 'coreValues', 'parents']);

        if ($authorizedPlanIds !== null) {
            $query->whereIn('record_id', $authorizedPlanIds->all());
        }

        if (empty($filters['status'])) {
            $query->whereIn('status', ['draft', 'finished']);
        } elseif (in_array($filters['status'], ['archived', 'deleted'], true)) {
            $query->whereRaw('1 = 0');
        } else {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $like = '%' . $search . '%';

            $query->where(function ($builder) use ($like) {
                $builder->where('title', 'like', $like)
                    ->orWhere('description', 'like', $like)
                    ->orWhereHas('missionFoundation', fn ($relation) => $relation->where('content', 'like', $like))
                    ->orWhereHas('visionFoundation', fn ($relation) => $relation->where('content', 'like', $like))
                    ->orWhereHas('coreValues', fn ($relation) => $relation->where('content', 'like', $like));
            });

            $query->orderByRaw(
                'case when title like ? then 0 when description like ? then 1 else 2 end',
                [$like, $like]
            );
        }
        if (! empty($filters['level'])) {
            $query->where('level', $filters['level']);
        }
        if (! empty($filters['year'])) {
            $query->whereYear('updated_at', $filters['year']);
        }

        return $query->orderByDesc('updated_at')
            ->paginate($filters['per_page'] ?? 10);
    }

    public function find(int $id): ?Strategic
    {
        return Strategic::with(['creator', 'missionFoundation', 'visionFoundation', 'coreValues', 'parents'])
            ->where('status', '!=', 'deleted')
            ->find($id);
    }

    public function create(array $data, User $user): Strategic
    {
        $data = $this->normalizePlanData($data, 'draft');
        $requestedStatus = $data['status'];
        $this->assertPlanPayloadMatchesStatus($data, $requestedStatus);

        return DB::transaction(function () use ($data, $user, $requestedStatus) {
            $foundationData = [
                'created_by' => $user->user_id,
                'version' => '1.0',
                'status' => 'active',
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => null,
            ];

            $mission = StrategicFoundations::create($foundationData + [
                'type' => 'MISSION',
                'content' => $data['mission'],
            ]);

            $vision = StrategicFoundations::create($foundationData + [
                'type' => 'VISION',
                'content' => $data['vision'],
            ]);

            $plan = Strategic::create([
                'created_by' => $user->user_id,
                'level' => $data['level'],
                'title' => $data['title'] !== '' ? $data['title'] : 'Untitled Strategic Plan',
                'description' => $data['description'],
                'department_agency' => $data['department_agency'],
                'planning_start_date' => $data['planning_start_date'],
                'planning_end_date' => $data['planning_end_date'],
                'status' => 'draft',
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => null,
                'mission_id' => $mission->foundation_id,
                'vision_id' => $vision->foundation_id,
            ]);

            $this->createCoreValueLinks($plan->record_id, $data['core_values'], $user->user_id);

            if ($requestedStatus === 'finished') {
                $this->finalizeEditablePlan($plan, $data, $user->user_id, 'finished');
            }

            $this->logWriter->write('strategic_plan.created', [
                'record_id' => $plan->record_id,
                'status' => $requestedStatus,
                'user_id' => $user->user_id,
                'after' => $this->planSnapshot($this->find($plan->record_id)),
            ]);

            return $this->find($plan->record_id);
        });
    }

    public function update(Strategic $plan, array $data, User $user): Strategic
    {
        $this->assertPlanCanBeEdited($plan);
        $before = $this->planSnapshot($plan);

        $data = $this->normalizePlanData($data, $plan->status);
        $targetStatus = $data['status'];
        $this->assertEditableStatusTransitionAllowed($plan, $targetStatus);
        $this->assertPlanPayloadMatchesStatus($data, $targetStatus);

        return DB::transaction(function () use ($plan, $data, $user, $targetStatus, $before) {
            $plan->missionFoundation->update([
                'content' => $data['mission'],
                'updated_by' => $user->user_id,
                'version' => '1.0',
            ]);

            $plan->visionFoundation->update([
                'content' => $data['vision'],
                'updated_by' => $user->user_id,
                'version' => '1.0',
            ]);

            $this->syncEditableCoreValues($plan->record_id, $data['core_values'], $user->user_id);

            $this->syncPlanFoundationsLifecycle($plan->record_id, $user->user_id);
            $this->finalizeEditablePlan($plan, $data, $user->user_id, $targetStatus);
            $after = $this->find($plan->record_id);

            $this->logWriter->write('strategic_plan.updated', [
                'record_id' => $plan->record_id,
                'status' => $targetStatus,
                'user_id' => $user->user_id,
                'before' => $before,
                'after' => $after ? $this->planSnapshot($after) : null,
            ]);

            return $after;
        });
    }

    public function delete(Strategic $plan): void
    {
        $userId = auth('api')->user()?->user_id ?? $plan->updated_by ?? $plan->created_by;
        $before = $this->planSnapshot($plan);

        DB::transaction(function () use ($plan, $userId, $before) {
            if ($plan->status === 'deleted') {
                return;
            }

            $plan->update([
                'status' => 'deleted',
                'updated_by' => $userId,
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => now(),
            ]);

            $this->deleteObjectives($plan->record_id, $userId);
            $this->deleteLinks($plan->record_id, $userId);
            $this->deleteRelations($plan->record_id);
            $this->syncPlanFoundationsLifecycle($plan->record_id, $userId);

            $this->logWriter->write('strategic_plan.deleted', [
                'record_id' => $plan->record_id,
                'user_id' => $userId,
                'before' => $before,
            ]);
        });
    }

    public function copy(Strategic $source, User $user): Strategic
    {
        $source->loadMissing(['missionFoundation', 'visionFoundation', 'coreValues']);

        return $this->create([
            'title' => Str::limit($source->title . ' (Copy)', 255, ''),
            'level' => $source->level,
            'description' => $source->description,
            'department_agency' => $source->department_agency,
            'planning_start_date' => $source->planning_start_date?->format('Y-m-d'),
            'planning_end_date' => $source->planning_end_date?->format('Y-m-d'),
            'mission' => $source->missionFoundation?->content ?? '',
            'vision' => $source->visionFoundation?->content ?? '',
            'core_values' => $source->coreValues->pluck('content')->all(),
            'status' => 'draft',
        ], $user);
    }

    public function updateStatus(Strategic $plan, string $status, User $user): Strategic
    {
        if ($plan->status === $status) {
            return $this->find($plan->record_id) ?? $plan;
        }

        if ($status === 'archived' && $plan->approval_status === 'under_approval') {
            throw ValidationException::withMessages([
                'status' => ['Plans under approval cannot be archived. Complete or return the current review first.'],
            ]);
        }

        $fromStatus = $plan->status;
        $before = $this->planSnapshot($plan);
        $this->assertStatusTransitionAllowed($plan, $status);

        DB::transaction(function () use ($plan, $status, $user) {
            if ($status === 'archived') {
                $this->archivePlan($plan->record_id, $user->user_id);
                return;
            }

            $this->restorePlan($plan->record_id, $user->user_id);
        });

        $this->logWriter->write('strategic_plan.status_changed', [
            'record_id' => $plan->record_id,
            'from' => $fromStatus,
            'to' => $status,
            'user_id' => $user->user_id,
            'before' => $before,
            'after' => $this->planSnapshot($this->find($plan->record_id) ?? $plan),
        ]);

        return $this->find($plan->record_id) ?? $plan;
    }

    private function normalizePlanData(array $data, string $defaultStatus): array
    {
        $coreValues = collect($data['core_values'] ?? [])
            ->map(fn ($value) => trim((string) $value))
            ->filter(fn (string $value) => $value !== '')
            ->values()
            ->all();

        return [
            'title' => trim((string) ($data['title'] ?? '')),
            'level' => $data['level'],
            'description' => $this->normalizeNullableString($data['description'] ?? null),
            'department_agency' => $this->normalizeNullableString($data['department_agency'] ?? null),
            'planning_start_date' => $data['planning_start_date'] ?? null,
            'planning_end_date' => $data['planning_end_date'] ?? null,
            'mission' => trim((string) ($data['mission'] ?? '')),
            'vision' => trim((string) ($data['vision'] ?? '')),
            'core_values' => $coreValues,
            'status' => $data['status'] ?? $defaultStatus,
        ];
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function assertPlanPayloadMatchesStatus(array $data, string $status): void
    {
        if (! in_array($status, ['draft', 'finished'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Plans can only be created or updated as draft or finished.'],
            ]);
        }

        if ($status !== 'finished') {
            return;
        }

        $errors = [];

        if ($data['title'] === '') {
            $errors['title'] = ['Finished plans require a title.'];
        }
        if ($data['mission'] === '') {
            $errors['mission'] = ['Finished plans require a mission statement.'];
        }
        if ($data['vision'] === '') {
            $errors['vision'] = ['Finished plans require a vision statement.'];
        }
        if (empty($data['core_values'])) {
            $errors['core_values'] = ['Finished plans require at least one core value.'];
        }

        if (! empty($errors)) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function assertPlanCanBeEdited(Strategic $plan): void
    {
        if ($plan->status === 'archived') {
            throw ValidationException::withMessages([
                'status' => ['Archived plans must be restored to finished before they can be edited.'],
            ]);
        }

        if ($plan->status === 'deleted') {
            throw ValidationException::withMessages([
                'status' => ['Deleted plans cannot be edited.'],
            ]);
        }
    }

    private function assertEditableStatusTransitionAllowed(Strategic $plan, string $targetStatus): void
    {
        $allowedTransitions = [
            'draft' => ['draft', 'finished'],
            'finished' => ['finished'],
        ];

        if (! in_array($targetStatus, $allowedTransitions[$plan->status] ?? [], true)) {
            throw ValidationException::withMessages([
                'status' => ['Draft plans can move to finished, but finished plans cannot be moved back to draft.'],
            ]);
        }
    }

    private function assertStatusTransitionAllowed(Strategic $plan, string $status): void
    {
        if ($plan->status === 'deleted') {
            throw ValidationException::withMessages([
                'status' => ['Deleted plans cannot change status.'],
            ]);
        }

        $allowedTransitions = [
            'finished' => ['archived'],
            'archived' => ['finished'],
        ];

        if (! in_array($status, $allowedTransitions[$plan->status] ?? [], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only finished plans can be archived, and only archived plans can be restored to finished.'],
            ]);
        }
    }

    private function archivePlan(int $planId, int $userId): void
    {
        $plan = Strategic::findOrFail($planId);

        $plan->update([
            'status' => 'archived',
            'updated_by' => $userId,
            'archived_at' => now(),
            'archived_by' => $userId,
            'deleted_at' => null,
        ]);


        $this->archiveLinks($planId, $userId);
        $this->syncRelationsForPlan($planId, $userId);
        $this->syncPlanFoundationsLifecycle($planId, $userId);
    }

    private function restorePlan(int $planId, int $userId): void
    {
        $plan = Strategic::findOrFail($planId);

        $plan->update([
            'status' => 'finished',
            'updated_by' => $userId,
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => null,
        ]);


        $this->restoreLinks($planId, $userId);
        $this->syncRelationsForPlan($planId, $userId);
        $this->syncPlanFoundationsLifecycle($planId, $userId);
    }

    private function finalizeEditablePlan(Strategic $plan, array $data, int $userId, string $status): void
    {
        $plan->update([
            'updated_by' => $userId,
            'level' => $data['level'],
            'title' => $data['title'] !== '' ? $data['title'] : 'Untitled Strategic Plan',
            'description' => $data['description'],
            'department_agency' => $data['department_agency'],
            'planning_start_date' => $data['planning_start_date'],
            'planning_end_date' => $data['planning_end_date'],
            'status' => $status,
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => null,
        ]);
    }

    private function createCoreValueLinks(int $planId, array $coreValues, int $userId): void
    {
        foreach ($coreValues as $content) {
            $this->createCoreValueLink($planId, $content, $userId);
        }
    }

    private function syncEditableCoreValues(int $planId, array $coreValues, int $userId): void
    {
        $existingLinks = Link::with('coreValue')
            ->where('plan_id', $planId)
            ->where('status', '!=', 'deleted')
            ->orderBy('link_id')
            ->get();

        $matchedLinkIds = [];
        $newContents = [];

        foreach (collect($coreValues)->values() as $content) {
            $matchingLink = $existingLinks->first(function (Link $link) use ($content, $matchedLinkIds) {
                return ! in_array($link->link_id, $matchedLinkIds, true)
                    && trim((string) $link->coreValue?->content) === $content;
            });

            if ($matchingLink) {
                $matchedLinkIds[] = $matchingLink->link_id;
                continue;
            }

            $newContents[] = $content;
        }

        $linksToDelete = $existingLinks->reject(
            fn (Link $link) => in_array($link->link_id, $matchedLinkIds, true)
        );

        foreach ($linksToDelete as $link) {
            $this->softDeleteLink($link, $userId);
            $this->syncFoundationLifecycleState($link->coreValue, $userId);
        }

        foreach ($newContents as $content) {
            $this->createCoreValueLink($planId, $content, $userId);
        }
    }

    private function createCoreValueLink(int $planId, string $content, int $userId): void
    {
        $coreValue = StrategicFoundations::create([
            'created_by' => $userId,
            'type' => 'CORE_VALUE',
            'content' => $content,
            'version' => '1.0',
            'status' => 'active',
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => null,
        ]);

        Link::create([
            'core_value_id' => $coreValue->foundation_id,
            'plan_id' => $planId,
            'created_by' => $userId,
            'updated_by' => $userId,
            'status' => 'active',
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => null,
        ]);
    }

    private function archiveObjectives(int $planId, int $userId): void
    {
        StrategicObjective::where('strategic_plan_id', $planId)
            ->where('status', '!=', 'deleted')
            ->get()
            ->each(function (StrategicObjective $objective) use ($userId) {
                if ($objective->status === 'archived') {
                    return;
                }

                $objective->update([
                    'updated_by' => $userId,
                    'status_before_archive' => $objective->status,
                    'status' => 'archived',
                    'archived_at' => now(),
                    'archived_by' => $userId,
                    'deleted_at' => null,
                ]);
            });
    }

    private function restoreObjectives(int $planId, int $userId): void
    {
        StrategicObjective::where('strategic_plan_id', $planId)
            ->where('status', 'archived')
            ->get()
            ->each(function (StrategicObjective $objective) use ($userId) {
                $objective->update([
                    'updated_by' => $userId,
                    'status' => $objective->status_before_archive ?? 'draft',
                    'status_before_archive' => null,
                    'archived_at' => null,
                    'archived_by' => null,
                    'deleted_at' => null,
                ]);
            });
    }

    private function deleteObjectives(int $planId, int $userId): void
    {
        StrategicObjective::where('strategic_plan_id', $planId)
            ->where('status', '!=', 'deleted')
            ->update([
                'updated_by' => $userId,
                'status' => 'deleted',
                'status_before_archive' => null,
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => now(),
            ]);
    }

    private function archiveLinks(int $planId, int $userId): void
    {
        Link::where('plan_id', $planId)
            ->where('status', '!=', 'deleted')
            ->get()
            ->each(function (Link $link) use ($userId) {
                if ($link->status === 'archived') {
                    return;
                }

                $link->update([
                    'updated_by' => $userId,
                    'status' => 'archived',
                    'archived_at' => now(),
                    'archived_by' => $userId,
                    'deleted_at' => null,
                ]);
            });
    }

    private function restoreLinks(int $planId, int $userId): void
    {
        Link::where('plan_id', $planId)
            ->where('status', 'archived')
            ->update([
                'updated_by' => $userId,
                'status' => 'active',
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => null,
            ]);
    }

    private function deleteLinks(int $planId, int $userId): void
    {
        Link::where('plan_id', $planId)
            ->where('status', '!=', 'deleted')
            ->get()
            ->each(function (Link $link) use ($userId) {
                $this->softDeleteLink($link, $userId);
            });
    }

    private function syncRelationsForPlan(int $planId, int $userId): void
    {
        Relation::where(function ($query) use ($planId) {
            $query->where('record_id', $planId)->orWhere('parent_id', $planId);
        })
            ->where('status', '!=', 'deleted')
            ->get()
            ->each(fn (Relation $relation) => $this->syncRelationLifecycleState($relation, $userId));
    }

    private function deleteRelations(int $planId): void
    {
        Relation::where(function ($query) use ($planId) {
            $query->where('record_id', $planId)->orWhere('parent_id', $planId);
        })
            ->where('status', '!=', 'deleted')
            ->update([
                'status' => 'deleted',
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => now(),
            ]);
    }

    private function syncRelationLifecycleState(Relation $relation, int $userId): void
    {
        $recordStatus = Strategic::whereKey($relation->record_id)->value('status');
        $parentStatus = Strategic::whereKey($relation->parent_id)->value('status');

        if (in_array('deleted', [$recordStatus, $parentStatus], true)) {
            $relation->update([
                'status' => 'deleted',
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => now(),
            ]);

            return;
        }

        if (in_array('archived', [$recordStatus, $parentStatus], true)) {
            if ($relation->status !== 'archived') {
                $relation->update([
                    'status' => 'archived',
                    'archived_at' => now(),
                    'archived_by' => $userId,
                    'deleted_at' => null,
                ]);
            }

            return;
        }

        if ($relation->status === 'archived') {
            $relation->update([
                'status' => 'active',
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => null,
            ]);
        }
    }

    private function syncPlanFoundationsLifecycle(int $planId, int $userId): void
    {
        $plan = Strategic::findOrFail($planId);

        $missionFoundation = StrategicFoundations::find($plan->mission_id);
        $visionFoundation = StrategicFoundations::find($plan->vision_id);

        $this->syncFoundationLifecycleState($missionFoundation, $userId);
        $this->syncFoundationLifecycleState($visionFoundation, $userId);

        $coreValueIds = Link::where('plan_id', $planId)->pluck('core_value_id')->unique();

        StrategicFoundations::whereIn('foundation_id', $coreValueIds)->get()
            ->each(fn (StrategicFoundations $foundation) => $this->syncFoundationLifecycleState($foundation, $userId));
    }

    private function syncFoundationLifecycleState(?StrategicFoundations $foundation, int $userId): void
    {
        if (! $foundation) {
            return;
        }

        $hasActivePlanReference = Strategic::where(function ($query) use ($foundation) {
            $query->where('mission_id', $foundation->foundation_id)
                ->orWhere('vision_id', $foundation->foundation_id);
        })
            ->whereIn('status', ['draft', 'finished'])
            ->exists();

        $hasArchivedPlanReference = Strategic::where(function ($query) use ($foundation) {
            $query->where('mission_id', $foundation->foundation_id)
                ->orWhere('vision_id', $foundation->foundation_id);
        })
            ->where('status', 'archived')
            ->exists();

        $hasActiveCoreValueReference = Link::where('core_value_id', $foundation->foundation_id)
            ->where('status', 'active')
            ->whereHas('plan', fn ($query) => $query->whereIn('status', ['draft', 'finished']))
            ->exists();

        $hasArchivedCoreValueReference = Link::where('core_value_id', $foundation->foundation_id)
            ->where('status', 'archived')
            ->whereHas('plan', fn ($query) => $query->where('status', 'archived'))
            ->exists();

        if ($hasActivePlanReference || $hasActiveCoreValueReference) {
            $foundation->update([
                'updated_by' => $userId,
                'status' => 'active',
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => null,
            ]);

            return;
        }

        if ($hasArchivedPlanReference || $hasArchivedCoreValueReference) {
            if ($foundation->status !== 'archived') {
                $foundation->update([
                    'updated_by' => $userId,
                    'status' => 'archived',
                    'archived_at' => now(),
                    'archived_by' => $userId,
                    'deleted_at' => null,
                ]);
            }

            return;
        }

        $foundation->update([
            'updated_by' => $userId,
            'status' => 'deleted',
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => now(),
        ]);
    }

    private function softDeleteLink(Link $link, int $userId): void
    {
        $link->update([
            'updated_by' => $userId,
            'status' => 'deleted',
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => now(),
        ]);
    }

    private function planSnapshot(?Strategic $plan): ?array
    {
        if (! $plan) {
            return null;
        }

        $plan->loadMissing(['missionFoundation', 'visionFoundation', 'coreValues']);

        return [
            'record_id' => $plan->record_id,
            'title' => $plan->title,
            'level' => $plan->level,
            'description' => $plan->description,
            'department_agency' => $plan->department_agency,
            'planning_start_date' => $plan->planning_start_date?->format('Y-m-d'),
            'planning_end_date' => $plan->planning_end_date?->format('Y-m-d'),
            'status' => $plan->status,
            'mission' => $plan->missionFoundation?->content,
            'vision' => $plan->visionFoundation?->content,
            'core_values' => $plan->coreValues->pluck('content')->values()->all(),
        ];
    }
}
