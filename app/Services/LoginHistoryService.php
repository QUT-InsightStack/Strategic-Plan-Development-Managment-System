<?php

namespace App\Services;

use App\Models\LoginHistory;
use App\Repositories\LoginHistoryRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class LoginHistoryService
{
    public function __construct(
        private readonly LoginHistoryRepository $repository
    ) {
    }

    public function search(array $filters): LengthAwarePaginator
    {
        $filters['sort_by'] ??= 'attempted_at';
        $filters['sort_direction'] ??= 'desc';
        $filters['per_page'] ??= 25;

        return $this->repository->search($filters);
    }

    public function getById(int $id): ?LoginHistory
    {
        return $this->repository->find($id);
    }
}