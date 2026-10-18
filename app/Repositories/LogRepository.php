<?php

namespace App\Repositories;

use App\Models\Log;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class LogRepository
{
    public function __construct(
        private readonly Log $model
    ) {
    }

    public function search(array $filters): LengthAwarePaginator
    {
        $query = $this->model
            ->newQuery()
            ->select('tbllog.*')
            ->with([
                'user:user_id,first_name,last_name,email',
            ]);

        $this->applyFilters($query, $filters);
        $this->applySort($query, $filters);

        return $query
            ->paginate((int) ($filters['per_page'] ?? 25))
            ->withQueryString();
    }

    public function find(int $id): ?Log
    {
        return $this->model
            ->newQuery()
            ->with([
                'user:user_id,first_name,last_name,email',
            ])
            ->find($id);
    }

    private function applyFilters(
        Builder $query,
        array $filters
    ): void {
        if (isset($filters['user_id'])) {
            $query->where(
                'tbllog.user_id',
                $filters['user_id']
            );
        }

        if (! empty($filters['action'])) {
            $query->forAction($filters['action']);
        }

        if (! empty($filters['resource_type'])) {
            $query->where(
                'tbllog.resource_type',
                $filters['resource_type']
            );
        }

        if (isset($filters['resource_id'])) {
            $query->where(
                'tbllog.resource_id',
                $filters['resource_id']
            );
        }

        if (! empty($filters['outcome'])) {
            $query->forOutcome($filters['outcome']);
        }

        if (! empty($filters['date_from'])) {
            $query->where(
                'tbllog.created_at',
                '>=',
                CarbonImmutable::parse($filters['date_from'], config('app.timezone'))->startOfDay()
            );
        }

        if (! empty($filters['date_to'])) {
            $query->where(
                'tbllog.created_at',
                '<',
                CarbonImmutable::parse($filters['date_to'], config('app.timezone'))->addDay()->startOfDay()
            );
        }

        if (! empty($filters['search'])) {
            $pattern = '%'
                . $this->escapeLike($filters['search'])
                . '%';

            $query->where(
                function (Builder $searchQuery) use ($pattern): void {
                    $searchQuery
                        ->where(
                            'tbllog.operation',
                            'like',
                            $pattern
                        )
                        ->orWhere(
                            'tbllog.actor_name',
                            'like',
                            $pattern
                        )
                        ->orWhere(
                            'tbllog.resource_type',
                            'like',
                            $pattern
                        )
                        ->orWhere(
                            'tbllog.states',
                            'like',
                            $pattern
                        )
                        ->orWhereHas(
                            'user',
                            function (Builder $userQuery) use ($pattern): void {
                                $userQuery
                                    ->where(
                                        'tblusers.first_name',
                                        'like',
                                        $pattern
                                    )
                                    ->orWhere(
                                        'tblusers.last_name',
                                        'like',
                                        $pattern
                                    )
                                    ->orWhere(
                                        'tblusers.email',
                                        'like',
                                        $pattern
                                    );
                            }
                        );
                }
            );
        }
    }

    private function applySort(
        Builder $query,
        array $filters
    ): void {
        $sortBy = $filters['sort_by'] ?? 'created_at';
        $direction = ($filters['sort_direction'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        if ($sortBy === 'outcome') {
            $query->orderByRaw(Log::outcomeSql() . ' ' . $direction)
                ->orderBy('tbllog.log_id', $direction);

            return;
        }

        $column = match ($sortBy) {
            'action' => 'tbllog.operation',
            'user' => 'tbllog.actor_name',
            'resource_type' => 'tbllog.resource_type',
            'outcome' => 'tbllog.outcome',
            default => 'tbllog.created_at',
        };

        $query
            ->orderBy($column, $direction)
            ->orderBy('tbllog.log_id', $direction);
    }

    private function escapeLike(string $value): string
    {
        return str_replace(
            ['\\', '%', '_'],
            ['\\\\', '\\%', '\\_'],
            $value
        );
    }
}
