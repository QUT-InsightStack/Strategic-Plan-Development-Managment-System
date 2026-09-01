<?php

namespace App\Repositories;

use App\Models\LoginHistory;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class LoginHistoryRepository
{
    public function __construct(
        private readonly LoginHistory $model
    ) {
    }

    public function search(array $filters): LengthAwarePaginator
    {
        $query = $this->baseQuery();

        $this->applyFilters($query, $filters);
        $this->applySort($query, $filters);

        return $query
            ->paginate((int) ($filters['per_page'] ?? 25))
            ->withQueryString();
    }

    public function find(int $id): ?LoginHistory
    {
        return $this->baseQuery()->find($id);
    }

    private function baseQuery(): Builder
    {
        return $this->model
            ->newQuery()
            ->select('tbllogin_history.*')
            ->with([
                /*
                 * Retrieving only the safe user fields needed by the resource.
                 */
                'user:user_id,first_name,last_name,email',
            ]);
    }

    private function applyFilters(
        Builder $query,
        array $filters
    ): void {
        if (isset($filters['user_id'])) {
            $query->where(
                'tbllogin_history.user_id',
                (int) $filters['user_id']
            );
        }

        if (! empty($filters['email'])) {
            $query->where(
                'tbllogin_history.email',
                $filters['email']
            );
        }

        if (! empty($filters['status'])) {
            $query->where(
                'tbllogin_history.status',
                $filters['status']
            );
        }

        if (! empty($filters['ip_address'])) {
            $query->where(
                'tbllogin_history.ip_address',
                $filters['ip_address']
            );
        }

        if (! empty($filters['date_from'])) {
            $dateFrom = CarbonImmutable::createFromFormat(
                'Y-m-d',
                $filters['date_from'],
                config('app.timezone')
            )->startOfDay();

            $query->where(
                'tbllogin_history.attempted_at',
                '>=',
                $dateFrom
            );
        }

        if (! empty($filters['date_to'])) {
            $dateTo = CarbonImmutable::createFromFormat(
                'Y-m-d',
                $filters['date_to'],
                config('app.timezone')
            )->endOfDay();

            $query->where(
                'tbllogin_history.attempted_at',
                '<=',
                $dateTo
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
                            'tbllogin_history.user_name',
                            'like',
                            $pattern
                        )
                        ->orWhere(
                            'tbllogin_history.email',
                            'like',
                            $pattern
                        )
                        ->orWhere(
                            'tbllogin_history.ip_address',
                            'like',
                            $pattern
                        );
                }
            );
        }
    }

    private function applySort(
        Builder $query,
        array $filters
    ): void {
        $sortBy = $filters['sort_by'] ?? 'attempted_at';
        $direction = $filters['sort_direction'] ?? 'desc';

        /*
         * Never pass a client-provided column name directly into orderBy().
         */
        $column = match ($sortBy) {
            'user' => 'tbllogin_history.user_name',
            'email' => 'tbllogin_history.email',
            'status' => 'tbllogin_history.status',
            'ip_address' => 'tbllogin_history.ip_address',
            default => 'tbllogin_history.attempted_at',
        };

        $query
            ->orderBy($column, $direction)
            ->orderBy(
                'tbllogin_history.login_history_id',
                $direction
            );
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