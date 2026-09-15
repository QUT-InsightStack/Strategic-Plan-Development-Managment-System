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
