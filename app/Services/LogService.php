<?php

namespace App\Services;

use App\Models\Log;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

class LogService
{
    public function getAll(array $filters = []): Collection
    {
        $query = Log::with('user')->latest();

        if (!empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }

        if (!empty($filters['states'])) {
            $query->where('states', $filters['states']);
        }

        return $query->get();
    }

    public function getById(int $id): ?Model
    {
        return Log::with('user')->find($id);
    }

    public function create(array $data): Model
    {
        return Log::create($data)->load('user');
    }

    public function update(int $id, array $data): ?Model
    {
        $log = Log::find($id);

        if (!$log) {
            return null;
        }

        $log->update($data);

        return $log->load('user');
    }

    public function delete(int $id): bool
    {
        $log = Log::find($id);

        return $log ? (bool) $log->delete() : false;
    }
}
