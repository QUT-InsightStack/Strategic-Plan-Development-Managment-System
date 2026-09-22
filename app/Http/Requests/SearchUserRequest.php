<?php

namespace App\Http\Requests;

use App\Repositories\UserRepository;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class SearchUserRequest extends ApiFormRequest
{
    /**
     * Only administrators may search user accounts. Mirrors the check in
     * StoreUserRequest so the two stay consistent.
     */
    public function authorize(): bool
    {
        $user = Auth::guard('api')->user();

        return $user && in_array($user->role?->role_name, ['Technical Administrator', 'Admin', 'test'], true);
    }

    public function rules(): array
    {
        return [
            // Free-text term matched against name, email and role name.
            // Capped so an oversized string cannot be used to load the query.
            'q'        => ['sometimes', 'nullable', 'string', 'max:255'],
            'role_id'  => ['sometimes', 'nullable', 'integer', Rule::exists('tblroles', 'role_id')],
            'status'   => ['sometimes', 'nullable', 'string', Rule::in(['active', 'inactive', 'suspended'])],

            // Advanced filters. Values come from the filter-options endpoint,
            // but are still length-capped rather than trusted.
            'unit'       => ['sometimes', 'nullable', 'string', 'max:255'],
            'office'     => ['sometimes', 'nullable', 'string', 'max:255'],
            'department' => ['sometimes', 'nullable', 'string', 'max:255'],

            // Constrained to a known column list; anything else is rejected
            // rather than reaching the query builder.
            'sort_by'  => ['sometimes', 'nullable', 'string', Rule::in(UserRepository::SORTABLE_COLUMNS)],
            'sort_dir' => ['sometimes', 'nullable', 'string', Rule::in(['asc', 'desc'])],
            'per_page' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:100'],
            'page'     => ['sometimes', 'nullable', 'integer', 'min:1'],
        ];
    }

    public function attributes(): array
    {
        return [
            'q'        => 'search term',
            'role_id'  => 'role',
            'sort_by'  => 'sort column',
            'sort_dir' => 'sort direction',
            'per_page' => 'results per page',
        ];
    }

    /**
     * Normalised filters for the service layer.
     */
    public function filters(): array
    {
        return [
            'term'       => (string) $this->query('q', ''),
            'role_id'    => $this->query('role_id'),
            'status'     => $this->query('status'),
            'unit'       => $this->query('unit'),
            'office'     => $this->query('office'),
            'department' => $this->query('department'),
            'sort_by'    => $this->query('sort_by'),
            'sort_dir'   => $this->query('sort_dir'),
            'per_page'   => $this->query('per_page'),
        ];
    }
}
