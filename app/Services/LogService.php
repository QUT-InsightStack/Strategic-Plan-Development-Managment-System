<?php

namespace App\Services;

use App\Models\Log;
use App\Repositories\LogRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class LogService
{
    public function __construct(
        private readonly LogRepository $logRepository
    ) {
    }

    public function search(array $filters): LengthAwarePaginator
    {
        $filters['sort_by'] ??= 'created_at';
        $filters['sort_direction'] ??= 'desc';
        $filters['per_page'] ??= 25;

        return $this->logRepository->search($filters);
    }

    public function getById(int $id): ?Log
    {
        return $this->logRepository->find($id);
    }
}