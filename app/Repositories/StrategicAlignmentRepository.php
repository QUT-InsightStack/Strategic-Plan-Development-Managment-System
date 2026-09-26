<?php

namespace App\Repositories;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class StrategicAlignmentRepository
{
    private const DEFINITIONS = [
        'pdp-chapter' => [
            'table' => 'tblobjective_pdp_chapter',
            'reference_column' => 'chapter_id',
            'reference_type' => 'pdp_chapter',
        ],
        'presidential-agenda' => [
            'table' => 'tblobjective_presidential_agenda',
            'reference_column' => 'agenda_id',
            'reference_type' => 'presidential_agenda_item',
        ],
    ];

    /**
     * @return array{table: string, reference_column: string, reference_type: string}
     */
    public function definition(string $type): array
    {
        return self::DEFINITIONS[$type]
            ?? throw new InvalidArgumentException('Unknown strategic alignment type.');
    }

    /**
     * Reads archived and active rows alike. The caller must hold a transaction.
     */
    public function findForUpdate(string $type, int $objectiveId, int $referenceId): ?object
    {
        $definition = $this->definition($type);

        return DB::table($definition['table'])
            ->where('objective_id', $objectiveId)
            ->where($definition['reference_column'], $referenceId)
            ->lockForUpdate()
            ->first([
                'objective_id',
                $definition['reference_column'].' as reference_id',
                'status',
                'archived_at',
                'archived_by',
                'created_at',
                'updated_at',
            ]);
    }

    /**
     * Changes only this mapping's lifecycle columns. Returns affected rows.
     */
    public function markArchived(
        string $type,
        int $objectiveId,
        int $referenceId,
        int $actorUserId,
        Carbon $archivedAt
    ): int {
        $definition = $this->definition($type);

        return DB::table($definition['table'])
            ->where('objective_id', $objectiveId)
            ->where($definition['reference_column'], $referenceId)
            ->where('status', 'active')
            ->update([
                'status' => 'archived',
                'archived_at' => $archivedAt,
                'archived_by' => $actorUserId,
                'updated_at' => $archivedAt,
            ]);
    }
}