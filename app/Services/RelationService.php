<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\Relation;
use App\Models\Strategic;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RelationService
{
    public function __construct(private readonly StrategicLogWriter $logWriter)
    {
    }

    public function getAll(?SupportCollection $authorizedRecordIds = null): Collection
    {
        $query = Relation::with(['record', 'parent', 'creator'])
            ->where('status', '!=', 'deleted');

        if ($authorizedRecordIds !== null) {
            $query->whereIn('record_id', $authorizedRecordIds->all());
        }

        return $query->get();
    }

    public function getById(int $id): ?Model
    {
        return Relation::with(['record', 'parent', 'creator'])
            ->where('status', '!=', 'deleted')
            ->find($id);
    }

    public function getByRecordId(int $recordId): Collection
    {
        return Relation::with(['parent', 'creator'])
            ->where('record_id', $recordId)
            ->where('status', '!=', 'deleted')
            ->get();
    }

    public function create(array $data): Model
    {
        $record = Strategic::findOrFail($data['record_id']);
        $this->ensureRecordCanBeChanged($record);

        $existing = Relation::where('record_id', $data['record_id'])
            ->where('parent_id', $data['parent_id'])
            ->first();

        if ($existing && $existing->status !== 'deleted') {
            throw ValidationException::withMessages([
                'parent_id' => ['This relationship already exists.'],
            ]);
        }

        if ($existing) {
            $existing->update([
                'created_by' => $data['created_by'],
                'status' => 'active',
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => null,
            ]);

            $this->logWriter->write('relation.restored', [
                'relation_id' => $existing->relation_id,
                'record_id' => $existing->record_id,
            ]);

            return $existing->load(['record', 'parent', 'creator']);
        }

        $relation = Relation::create($data + [
            'status' => 'active',
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => null,
        ]);

        $this->logWriter->write('relation.created', [
            'relation_id' => $relation->relation_id,
            'record_id' => $relation->record_id,
        ]);

        return $relation->load(['record', 'parent', 'creator']);
    }

    public function update(int $id, array $data): ?Model
    {
        $relation = Relation::where('status', '!=', 'deleted')->find($id);

        if (! $relation) {
            return null;
        }

        $recordId = $data['record_id'] ?? $relation->record_id;
        $record = Strategic::findOrFail($recordId);
        $this->ensureRecordCanBeChanged($record);

        $parentId = $data['parent_id'] ?? $relation->parent_id;
        $existing = Relation::where('record_id', $recordId)
            ->where('parent_id', $parentId)
            ->where('relation_id', '!=', $id)
            ->first();

        if ($existing && $existing->status !== 'deleted') {
            throw ValidationException::withMessages([
                'parent_id' => ['This relationship already exists.'],
            ]);
        }

        if ($existing) {
            $this->softDelete($relation);

            $existing->update([
                'created_by' => $data['created_by'] ?? $existing->created_by,
                'status' => 'active',
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => null,
            ]);

            $this->logWriter->write('relation.restored', [
                'relation_id' => $existing->relation_id,
                'record_id' => $existing->record_id,
            ]);

            return $existing->load(['record', 'parent', 'creator']);
        }

        $relation->update($data);

        $this->logWriter->write('relation.updated', [
            'relation_id' => $relation->relation_id,
            'record_id' => $relation->record_id,
        ]);

        return $relation->load(['record', 'parent', 'creator']);
    }

    public function delete(int $id): bool
    {
        $relation = Relation::where('status', '!=', 'deleted')->find($id);

        if (! $relation) {
            return false;
        }

        $record = Strategic::findOrFail($relation->record_id);
        $this->ensureRecordCanBeChanged($record);
        $this->softDelete($relation);

        $this->logWriter->write('relation.deleted', [
            'relation_id' => $relation->relation_id,
            'record_id' => $relation->record_id,
        ]);

        return true;
    }

    public function syncParents(int $recordId, array $parentIds, int $createdBy): Collection
    {
        return DB::transaction(function () use ($recordId, $parentIds, $createdBy) {
            $record = Strategic::findOrFail($recordId);
            $this->ensureRecordCanBeChanged($record);

            $activeRelations = Relation::where('record_id', $recordId)
                ->where('status', '!=', 'deleted')
                ->get();

            foreach ($activeRelations as $relation) {
                $this->softDelete($relation);
            }

            foreach ($parentIds as $parentId) {
                $existing = Relation::where('record_id', $recordId)
                    ->where('parent_id', $parentId)
                    ->first();

                if ($existing) {
                    $existing->update([
                        'created_by' => $createdBy,
                        'status' => 'active',
                        'archived_at' => null,
                        'archived_by' => null,
                        'deleted_at' => null,
                    ]);

                    continue;
                }

                Relation::create([
                    'record_id' => $recordId,
                    'parent_id' => $parentId,
                    'created_by' => $createdBy,
                    'status' => 'active',
                    'archived_at' => null,
                    'archived_by' => null,
                    'deleted_at' => null,
                ]);
            }

            $this->logWriter->write('relation.synced', [
                'record_id' => $recordId,
                'count' => count($parentIds),
            ]);

            return $this->getByRecordId($recordId);
        });
    }

    private function ensureRecordCanBeChanged(Strategic $record): void
    {
        if ($record->status === 'archived') {
            throw ValidationException::withMessages([
                'record_id' => ['Archived strategic plans must be restored before their relations can be changed.'],
            ]);
        }

        if ($record->status === 'deleted') {
            throw ValidationException::withMessages([
                'record_id' => ['Deleted strategic plans cannot be changed.'],
            ]);
        }
    }

    private function softDelete(Relation $relation): void
    {
        $relation->update([
            'status' => 'deleted',
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => now(),
        ]);
    }
}
