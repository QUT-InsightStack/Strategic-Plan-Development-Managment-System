<?php

namespace App\Repositories;

use App\Models\User;
use App\Models\Role;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;


class UserRepository
{
    /**
     * Columns a caller is allowed to sort by. Anything outside this list is
     * rejected rather than interpolated, so the sort parameter can never
     * reach the query as raw input.
     */
    public const SORTABLE_COLUMNS = [
        'user_id',
        'first_name',
        'last_name',
        'email',
        'status',
        'created_at',
    ];

    protected $model;

    public function __construct(User $user)
    {
        $this->model = $user;
    }

    public function all(): Collection
    {
        return $this->model->all();
    }

    /**
     * Distinct non-empty values for the advanced filter dropdowns.
     *
     * Sourced from the data rather than a fixed list, so the options always
     * reflect what actually exists on user records.
     *
     * @return array{units:string[],offices:string[],departments:string[]}
     */
    public function filterOptions(): array
    {
        return [
            'units'       => $this->distinctValues('unit'),
            'offices'     => $this->distinctValues('office'),
            'departments' => $this->distinctValues('department'),
        ];
    }

    /**
     * Distinct, sorted, non-empty values for a single column.
     *
     * The column is checked against a fixed list before use: it reaches the
     * query builder as an identifier rather than a binding, so it must never
     * come straight from request input.
     *
     * @return string[]
     */
    protected function distinctValues(string $column): array
    {
        if (! in_array($column, ['unit', 'office', 'department'], true)) {
            return [];
        }

        return $this->model->newQuery()
            ->whereNotNull($column)
            ->where($column, '!=', '')
            ->distinct()
            ->orderBy($column)
            ->pluck($column)
            ->all();
    }

    public function find(int $id): ?Model
    {
        return $this->model->find($id);
    }

    public function create(array $data): Model
    {
        return $this->model->create($data);
    }

    public function update(int $id, array $data): bool
    {
        $record = $this->find($id);
        return $record ? $record->update($data) : false;
    }

    public function delete(int $id): bool
    {
        $record = $this->find($id);
        return $record ? $record->delete() : false;
    }

    public function search(array $filters): LengthAwarePaginator
    {
        $search = $filters['search'] ?? null;
        $searchBy = $filters['search_by'] ?? 'all';
        $sortBy = $filters['sort_by'] ?? 'name';
        $sortDirection = $filters['sort_direction'] ?? 'asc';
        $perPage = $filters['per_page'] ?? 15;

        $query = $this->model
            ->newQuery()
            ->select('tblusers.*')
            ->with([
                'role:role_id,role_name',
            ]);

        if (isset($filters['role_id'])) {
            $query->where(
                'tblusers.role_id',
                $filters['role_id']
            );
        }

        if (isset($filters['status'])) {
            $query->where(
                'tblusers.status',
                $filters['status']
            );
        }

        // Advanced filters. Matched exactly rather than partially: these are
        // chosen from dropdowns of existing values, so an exact match is what
        // the caller intends.
        foreach (['unit', 'office', 'department'] as $field) {
            if (! empty($filters[$field])) {
                $query->where("tblusers.{$field}", $filters[$field]);
            }
        }

        if ($search !== null && $search !== '') {
            $pattern = '%' . $this->escapeLike($search) . '%';

            $query->where(function (Builder $searchQuery) use (
                $searchBy,
                $pattern
            ): void {
                if ($searchBy === 'all' || $searchBy === 'name') {
                    $searchQuery->where(function (Builder $nameQuery) use (
                        $pattern
                    ): void {
                        $nameQuery
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
                            ->orWhereRaw(
                                "CONCAT_WS(' ', tblusers.first_name, tblusers.last_name) LIKE ? ESCAPE '\\\\'",
                                [$pattern]
                            );
                    });
                }

                if ($searchBy === 'all' || $searchBy === 'email') {
                    $method = $searchBy === 'all'
                        ? 'orWhere'
                        : 'where';

                    $searchQuery->{$method}(
                        'tblusers.email',
                        'like',
                        $pattern
                    );
                }

                if ($searchBy === 'all' || $searchBy === 'role') {
                    $method = $searchBy === 'all'
                        ? 'orWhereHas'
                        : 'whereHas';

                    $searchQuery->{$method}(
                        'role',
                        function (Builder $roleQuery) use ($pattern): void {
                            $roleQuery->where(
                                'tblroles.role_name',
                                'like',
                                $pattern
                            );
                        }
                    );
                }
            });
        }

        $this->applySort(
            $query,
            $sortBy,
            $sortDirection
        );

        return $query
            ->paginate($perPage)
            ->withQueryString();
    }

    private function applySort(
        Builder $query,
        string $sortBy,
        string $sortDirection
    ): void {
        switch ($sortBy) {
            case 'email':
                $query->orderBy('tblusers.email', $sortDirection);
                break;

            case 'role':
                $query->orderBy(
                    Role::query()
                        ->select('role_name')
                        ->whereColumn(
                            'tblroles.role_id',
                            'tblusers.role_id'
                        )
                        ->limit(1),
                    $sortDirection
                );
                break;

            case 'status':
                $query->orderBy('tblusers.status', $sortDirection);
                break;

            case 'created_at':
                $query->orderBy('tblusers.created_at', $sortDirection);
                break;

            case 'name':
            default:
                $query
                    ->orderBy('tblusers.first_name', $sortDirection)
                    ->orderBy('tblusers.last_name', $sortDirection);
                break;
        }

        // Stable pagination when the selected values are identical.
        $query->orderBy('tblusers.user_id', 'asc');
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