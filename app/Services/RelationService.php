<?php

namespace App\Services;

use App\Models\Relation;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RelationService
{
    public function getAll(): Collection
    {
        return Relation::with(['record', 'parent', 'creator'])->get();
    }

    public function getById(int $id): ?Model
    {
        return Relation::with(['record', 'parent', 'creator'])->find($id);
    }

    public function getByRecordId(int $recordId): Collection
    {
        return Relation::with(['parent', 'creator'])
            ->where('record_id', $recordId)
            ->get();
    }

    public function create(array $data): Model
    {
        return Relation::create($data)->load(['record', 'parent', 'creator']);
    }

    public function update(int $id, array $data): ?Model
    {
        $relation = Relation::find($id);

        if (!$relation) {
            return null;
        }

        $recordId = $data['record_id'] ?? $relation->record_id;
        $parentId = $data['parent_id'] ?? $relation->parent_id;

        $exists = Relation::where('record_id', $recordId)
            ->where('parent_id', $parentId)
            ->where('relation_id', '!=', $id)
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'parent_id' => ['This relationship already exists.'],
            ]);
        }

        $relation->update($data);

        return $relation->load(['record', 'parent', 'creator']);
    }

    public function delete(int $id): bool
    {
        $relation = Relation::find($id);

        return $relation ? (bool) $relation->delete() : false;
    }

    public function syncParents(int $recordId, array $parentIds, int $createdBy): Collection
    {
        return DB::transaction(function () use ($recordId, $parentIds, $createdBy) {
            Relation::where('record_id', $recordId)->delete();

            foreach ($parentIds as $parentId) {
                Relation::create([
                    'record_id' => $recordId,
                    'parent_id' => $parentId,
                    'created_by' => $createdBy,
                ]);
            }

            return $this->getByRecordId($recordId);
        });
    }
}
