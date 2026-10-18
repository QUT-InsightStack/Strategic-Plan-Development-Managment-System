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
    /**
     * Plan states in which active mappings may be created, replaced, or
     * archived. Submission moves a plan to finished + under_approval, so
     * finalized, submitted, under-review, approved, and rejected plans are
     * excluded until an authorised workflow explicitly permits changes.
     */
    public const MUTABLE_PLAN_STATUSES = ['draft'];

    public const MUTABLE_APPROVAL_STATUSES = ['not_submitted'];

    /**
     * The caller must hold the plan lock inside the transaction.
     */
    public function ensurePlanPermitsAlignmentChanges(Strategic $plan): void
    {
        $message = match (true) {
            $plan->status === 'deleted' =>
                'Deleted strategic plans cannot be changed.',
            $plan->status === 'archived' =>
                'Archived strategic plans must be restored before their alignment mappings can be changed.',
            $plan->approval_status === 'under_approval' =>
                'Alignment mappings cannot be changed while the strategic plan is under approval.',
            $plan->approval_status === 'approved' =>
                'Alignment mappings cannot be changed after the strategic plan has been approved.',
            $plan->approval_status === 'rejected' =>
                'Alignment mappings cannot be changed for a rejected strategic plan unless an authorised revision workflow allows modification.',
            ! in_array($plan->approval_status, self::MUTABLE_APPROVAL_STATUSES, true) =>
                'The strategic plan approval state does not permit alignment changes.',
            ! in_array($plan->status, self::MUTABLE_PLAN_STATUSES, true) =>
                'Alignment mappings cannot be changed after the strategic plan has been finalized.',
            default => null,
        };

        if ($message !== null) {
            throw ValidationException::withMessages([
                'strategic_plan_id' => [$message],
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

    /**
     * Adds mappings to supplied lists only. Active mappings are never removed
     * here: removal must go through the archive action, which requires its
     * own permission and preserves the mapping row. The caller must lock the
     * objective in a transaction.
     */
    public function update(StrategicObjective $objective, array $data): array
    {
        $relations = [
            'pdp_chapter_ids' => $objective->pdpChapters(),
            'presidential_agenda_item_ids' => $objective->presidentialAgendaItems(),
        ];

        $additions = [];
        $errors = [];

        // Validate both lists before changing either one.
        foreach ($relations as $field => $relation) {
            if (! array_key_exists($field, $data)) {
                continue;
            }

            $requested = array_map('intval', $data[$field]);

            // newPivotQuery() applies wherePivot('status', 'active').
            $existingActive = array_map('intval', $relation->newPivotQuery()
                ->lockForUpdate()
                ->pluck($relation->getRelatedPivotKeyName())
                ->all());

            $omitted = array_values(array_diff($existingActive, $requested));

            if ($omitted !== []) {
                $errors[$field] = [
                    'Active mappings cannot be removed by replacing the alignment list. '
                    .'Use the archive action for reference ID(s): '.implode(', ', $omitted).'.',
                ];

                continue;
            }

            $additions[$field] = array_values(array_diff($requested, $existingActive));
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $changes = [];

        foreach ($additions as $field => $added) {
            $this->attachNewMappings(
                $relations[$field],
                $field,
                $added,
                activeOnly: $field === 'presidential_agenda_item_ids'
            );

            if ($added !== []) {
                $changes[$field] = ['added' => $added];
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