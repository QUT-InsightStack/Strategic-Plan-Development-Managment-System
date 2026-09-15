<?php

namespace App\Services;

use App\Models\StrategicObjective;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Validation\ValidationException;

class StrategicObjectiveAlignmentService
{
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
     * Replace supplied lists only. The caller must lock the objective in a transaction.
     * Retained pivots (including historical inactive agenda links) are never rewritten.
     */
    public function update(StrategicObjective $objective, array $data): array
    {
        $changes = [];

        foreach ([
            'pdp_chapter_ids' => $objective->pdpChapters(),
            'presidential_agenda_item_ids' => $objective->presidentialAgendaItems(),
        ] as $field => $relation) {
            if (! array_key_exists($field, $data)) {
                continue;
            }

            $existing = $relation->newPivotQuery()->lockForUpdate()
                ->pluck($relation->getRelatedPivotKeyName())->all();
            $added = array_diff($data[$field], $existing);
            $removed = array_values(array_diff($existing, $data[$field]));

            $this->attachNewMappings($relation, $field, $added, activeOnly: $field === 'presidential_agenda_item_ids');
            if ($removed !== []) {
                $relation->detach($removed);
            }

            if ($added !== [] || $removed !== []) {
                $changes[$field] = ['added' => array_values($added), 'removed' => $removed];
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
        $existing = $relation->newPivotQuery()
            ->whereIn($relation->getRelatedPivotKeyName(), $ids)
            ->lockForUpdate()
            ->pluck($relation->getRelatedPivotKeyName())
            ->all();

        $errors = [];
        foreach ($ids as $index => $id) {
            $reference = $references->get($id);

            if (! $reference || ($activeOnly && $reference->status !== 'active')) {
                $errors["{$field}.{$index}"] = ['The selected reference does not exist or is inactive.'];
            } elseif (in_array($id, $existing)) {
                $errors["{$field}.{$index}"] = ['This reference is already mapped to the strategic objective.'];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        try {
            $relation->attach($ids);
        } catch (UniqueConstraintViolationException) {
            // The composite key also guards against writers that bypass the objective lock.
            throw ValidationException::withMessages([
                $field => ['One or more references are already mapped to the strategic objective.'],
            ]);
        }
    }
}
