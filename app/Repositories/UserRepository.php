<?php

namespace App\Repositories;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

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
     * Search users by name, email or role.
     *
     * Matching is partial and case-insensitive. Bindings are parameterised by
     * the query builder, and the LIKE wildcards `%` and `_` are escaped so a
     * search for "a_b" is treated literally rather than as a pattern.
     *
     * Inactive and suspended users are included; callers surface the status
     * so an administrator can tell accounts apart.
     *
     * @param array{term?:string,role_id?:int,status?:string,sort_by?:string,sort_dir?:string,per_page?:int} $filters
     */
    public function search(array $filters = []): LengthAwarePaginator
    {
        $query = $this->model->newQuery()->with('role:role_id,role_name');

        $term = trim((string) ($filters['term'] ?? ''));

        if ($term !== '') {
            $like = '%' . $this->escapeLike($term) . '%';

            $query->where(function ($builder) use ($like) {
                $builder->whereRaw('LOWER(first_name) LIKE ?', [mb_strtolower($like)])
                    ->orWhereRaw('LOWER(last_name) LIKE ?', [mb_strtolower($like)])
                    ->orWhereRaw("LOWER(CONCAT(first_name, ' ', COALESCE(last_name, ''))) LIKE ?", [mb_strtolower($like)])
                    ->orWhereRaw('LOWER(email) LIKE ?', [mb_strtolower($like)])
                    ->orWhereHas('role', function ($roleQuery) use ($like) {
                        $roleQuery->whereRaw('LOWER(role_name) LIKE ?', [mb_strtolower($like)]);
                    });
            });
        }

        if (! empty($filters['role_id'])) {
            $query->where('role_id', $filters['role_id']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        // Advanced filters. Matched exactly rather than partially: these are
        // chosen from dropdowns of existing values, so an exact match is what
        // the caller intends.
        foreach (['unit', 'office', 'department'] as $field) {
            if (! empty($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }

        $sortBy = in_array($filters['sort_by'] ?? '', self::SORTABLE_COLUMNS, true)
            ? $filters['sort_by']
            : 'user_id';

        $sortDir = strtolower($filters['sort_dir'] ?? '') === 'desc' ? 'desc' : 'asc';

        $perPage = (int) ($filters['per_page'] ?? 15);
        $perPage = max(1, min($perPage, 100));

        return $query->orderBy($sortBy, $sortDir)->paginate($perPage);
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

    /**
     * Escape LIKE wildcards so user input is matched literally.
     */
    protected function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $value);
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
}