<?php

namespace App\Services;

use App\Models\StrategicFoundations;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

class FoundationsService
{
    public function getAll(?string $type = null): Collection
    {
        $query = StrategicFoundations::with($this->relations());

        if ($type) {
            $query->where('type', $type);
        }

        return $query->get();
    }

    public function getById(int $id): ?Model
    {
        return StrategicFoundations::with($this->relations())->find($id);
    }

    public function create(array $data): Model
    {
        return StrategicFoundations::create($data)->load($this->relations());
    }

    public function update(int $id, array $data): ?Model
    {
        $foundation = StrategicFoundations::find($id);

        if (!$foundation) {
            return null;
        }

        $foundation->update($data);

        return $foundation->load($this->relations());
    }

    public function delete(int $id): bool
    {
        $foundation = StrategicFoundations::find($id);

        return $foundation ? (bool) $foundation->delete() : false;
    }

    protected function relations(): array
    {
        return [
            'creator',
            'updater',
        ];
    }
}
