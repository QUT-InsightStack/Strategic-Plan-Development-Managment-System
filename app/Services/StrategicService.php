<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\Strategic;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StrategicService
{
    public function __construct(
        protected RelationService $relationService,
        private readonly StrategicLogWriter $logWriter
    ) {
    }

    public function getAll(): Collection
    {
        return Strategic::with($this->relations())
            ->where('status', '!=', 'deleted')
            ->get();
    }

    public function getById(int $id): ?Model
    {
        return Strategic::with($this->relations())
            ->where('status', '!=', 'deleted')
            ->find($id);
    }

    public function create(array $data): Model
    {
        $parentIds = $data['parent_ids'] ?? null;
        unset($data['parent_ids']);

        return DB::transaction(function () use ($data, $parentIds) {
            $strategic = Strategic::create($data + [
                'status' => $data['status'] ?? 'draft',
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => null,
            ]);

            if ($parentIds !== null) {
                $this->relationService->syncParents(
                    $strategic->record_id,
                    $parentIds,
                    $data['created_by']
                );
            }

            $this->logWriter->write('strategic_record.created', [
                'record_id' => $strategic->record_id,
            ]);

            return $this->getById($strategic->record_id);
        });
    }

    public function update(int $id, array $data): ?Model
    {
        $strategic = Strategic::where('status', '!=', 'deleted')->find($id);

        if (! $strategic) {
            return null;
        }

        $this->ensureStrategicCanBeChanged($strategic);

        $parentIds = $data['parent_ids'] ?? null;
        unset($data['parent_ids']);

        return DB::transaction(function () use ($strategic, $data, $parentIds) {
            $strategic->update($data);

            if ($parentIds !== null) {
                $this->relationService->syncParents(
                    $strategic->record_id,
                    $parentIds,
                    $data['updated_by'] ?? $strategic->created_by
                );
            }

            $this->logWriter->write('strategic_record.updated', [
                'record_id' => $strategic->record_id,
            ]);

            return $this->getById($strategic->record_id);
        });
    }

    public function delete(int $id): bool
    {
        $strategic = Strategic::where('status', '!=', 'deleted')->find($id);

        if (! $strategic) {
            return false;
        }

        $strategic->update([
            'status' => 'deleted',
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => now(),
        ]);

        $this->logWriter->write('strategic_record.deleted', [
            'record_id' => $strategic->record_id,
        ]);

        return true;
    }

    protected function relations(): array
    {
        return [
            'creator',
            'updater',
            'missionFoundation',
            'visionFoundation',
            'parents',
            'children',
        ];
    }

    private function ensureStrategicCanBeChanged(Strategic $strategic): void
    {
        if ($strategic->status === 'archived') {
            throw ValidationException::withMessages([
                'status' => ['Archived strategic records must be restored before they can be changed.'],
            ]);
        }
    }
}
