<?php

namespace App\Services;

use App\Models\Strategic;
use App\Models\StrategicObjective;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StrategicObjectiveAlignmentService
{
    // Finished plans cannot return to draft. Permit preparation/revision while
    // keeping submitted snapshots immutable and blocking live approval changes.
    public const MUTABLE_PLAN_STATUSES = ['draft', 'finished'];
    public const MUTABLE_APPROVAL_STATUSES = ['not_submitted', 'rejected'];

    public function ensurePlanPermitsAlignmentChanges(Strategic $plan): void
    {
        if (! in_array($plan->status, self::MUTABLE_PLAN_STATUSES, true)
            || ! in_array($plan->approval_status, self::MUTABLE_APPROVAL_STATUSES, true)) {
            throw ValidationException::withMessages([
                'strategic_plan_id' => ['Only draft or finished plans outside active approval can change alignments. Archived, deleted, under-approval and approved plans are locked.'],
            ]);
        }
    }

    /**
     * The caller must hold the objective lock inside a database transaction.
     */
    public function create(StrategicObjective $objective, array $data): void
    {
        $this->attachNewMappings(
            $objective->pdpChapters(),
            'pdp_chapter_ids',
            $data['pdp_chapter_ids'] ?? [],
        );
        $this->attachNewMappings(
            $objective->presidentialAgendaItems(),
            'presidential_agenda_item_ids',
            $data['presidential_agenda_item_ids'] ?? [],
            activeOnly: true,
        );
    }

    /** Replace the active selection; omitted links are archived, never discarded. */
    public function update(StrategicObjective $objective, array $data): array
    {
        $actor = app(PermissionAuthorizationService::class)->resolveUser();
        $changes = [];
        foreach ([
            'pdp_chapter_ids' => [$objective->pdpChaptersWithArchived(), 'pdp-chapter'],
            'presidential_agenda_item_ids' => [$objective->presidentialAgendaItemsWithArchived(), 'presidential-agenda'],
        ] as $field => [$relation, $type]) {
            if (! array_key_exists($field, $data)) {
                continue;
            }
            $requested = array_map('intval', $data[$field]);
            $statuses = $relation->newPivotQuery()->lockForUpdate()->pluck('status', $relation->getRelatedPivotKeyName());
            $active = $statuses->filter(fn ($status) => $status === 'active')->keys()->map(fn ($id) => (int) $id)->all();
            $removed = array_values(array_diff($active, $requested));
            $added = array_values(array_diff($requested, $active));
            $new = array_diff($requested, $statuses->keys()->all());
            $restored = array_values(array_intersect($added, $statuses->keys()->all()));
            // All operations share the controller's transaction and parent locks.
            $this->attachNewMappings($relation, $field, $new, activeOnly: $field === 'presidential_agenda_item_ids');
            foreach ($removed as $referenceId) {
                app(StrategicAlignmentArchiveService::class)->archive($objective->objective_id, $type, $referenceId, $actor);
            }
            foreach ($restored as $referenceId) {
                app(StrategicAlignmentLifecycleService::class)->restore($objective->objective_id, $type, $referenceId, $actor);
            }
            if ($added !== [] || $removed !== []) {
                $changes[$field] = ['added' => $added, 'removed' => $removed];
            }
        }
        return $changes;
    }

    private function attachNewMappings(BelongsToMany $relation, string $field, array $ids, bool $activeOnly = false): void
    {
        if ($ids === []) {
            return;
        }

        // Keep references present (and their status stable) until the mappings commit.
        $references = $relation->getRelated()->newQuery()
            ->whereKey($ids)
            ->orderBy($relation->getRelated()->getKeyName())
            ->sharedLock()
            ->get()
            ->keyBy($relation->getRelated()->getKeyName());

        // Read the pivot without the active-only filter, so archived pairs are
        // reported clearly instead of failing on the composite primary key.
        $pivotStatuses = DB::table($relation->getTable())
            ->where(
                $relation->getForeignPivotKeyName(),
                $relation->getParent()->getAttribute($relation->getParentKeyName())
            )
            ->whereIn($relation->getRelatedPivotKeyName(), $ids)
            ->lockForUpdate()
            ->pluck('status', $relation->getRelatedPivotKeyName());

        $errors = [];
        foreach ($ids as $index => $id) {
            $reference = $references->get($id);
            $pivotStatus = $pivotStatuses->get($id);

            if (! $reference || ($activeOnly && $reference->status !== 'active')) {
                $errors["{$field}.{$index}"] = ['The selected reference does not exist or is inactive.'];
            } elseif ($pivotStatus === 'archived') {
                $errors["{$field}.{$index}"] = ['This mapping was archived and cannot be re-added without an authorised restore action.'];
            } elseif ($pivotStatus !== null) {
                $errors["{$field}.{$index}"] = ['This reference is already mapped to the strategic objective.'];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        try {
            // New rows take the database default status of active.
            $relation->attach($ids);
        } catch (UniqueConstraintViolationException) {
            // The composite key also guards against writers that bypass the objective lock.
            throw ValidationException::withMessages([
                $field => ['One or more references are already mapped to the strategic objective.'],
            ]);
        }
    }
}
