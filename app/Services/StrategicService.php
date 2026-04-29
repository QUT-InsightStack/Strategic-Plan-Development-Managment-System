<?php

namespace App\Services;

use App\Models\Strategic;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class StrategicService
{
    protected $relationService;

    public function __construct(RelationService $relationService)
    {
        $this->relationService = $relationService;
    }

    public function getAll(): Collection
    {
        return Strategic::with($this->relations())->get();
    }

    public function getById(int $id): ?Model
    {
        return Strategic::with($this->relations())->find($id);
    }

    public function create(array $data): Model
    {
        $parentIds = $data['parent_ids'] ?? null;
        unset($data['parent_ids']);

        return DB::transaction(function () use ($data, $parentIds) {
            $strategic = Strategic::create($data);

            if ($parentIds !== null) {
                $this->relationService->syncParents(
                    $strategic->record_id,
                    $parentIds,
                    $data['created_by']
                );
            }

            return $this->getById($strategic->record_id);
        });
    }

    public function update(int $id, array $data): ?Model
    {
        $strategic = Strategic::find($id);

        if (!$strategic) {
            return null;
        }

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

            return $this->getById($strategic->record_id);
        });
    }

    public function delete(int $id): bool
    {
        $strategic = Strategic::find($id);

        return $strategic ? (bool) $strategic->delete() : false;
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
}
