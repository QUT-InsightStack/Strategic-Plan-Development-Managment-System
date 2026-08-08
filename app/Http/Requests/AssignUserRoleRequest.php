<?php

namespace App\Http\Requests;

use App\Models\Role;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class AssignUserRoleRequest extends ApiFormRequest
{
    /**
     * Only administrators may change role assignments.
     *
     * The privilege-escalation rules themselves live in withValidator(), not
     * here: this answers "may you manage roles at all", while those answer
     * "may you assign this particular role".
     */
    public function authorize(): bool
    {
        $user = Auth::guard('api')->user();

        return $user && in_array($user->role?->role_name, Role::ADMIN_ROLES, true);
    }

    public function rules(): array
    {
        return [
            // Nullable so a role can be removed, leaving the user with none.
            'role_id' => ['present', 'nullable', 'integer', Rule::exists('tblroles', 'role_id')],
        ];
    }

    public function attributes(): array
    {
        return [
            'role_id' => 'role',
        ];
    }

    /**
     * Rules that depend on who is acting and on whom.
     *
     * Enforced server-side because the frontend cannot be trusted: a crafted
     * request must not be able to bypass them.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $actor = Auth::guard('api')->user();

            if (! $actor) {
                return;
            }

            $targetId = (int) $this->route('id');
            $roleId   = $this->input('role_id');
            $target   = \App\Models\User::find($targetId);

            if (! $target) {
                return; // The controller returns 404 for this case.
            }

            // An administrator changing their own role could lock themselves,
            // and potentially the last administrator, out of user management.
            if ((int) $actor->user_id === $targetId) {
                $validator->errors()->add('role_id', 'You cannot change your own role. Ask another administrator to make this change.');
                return;
            }

            // Removing the final administrator would leave nobody able to
            // manage users or restore the role.
            if ($this->wouldRemoveLastAdministrator($target, $roleId)) {
                $validator->errors()->add('role_id', 'This is the only remaining administrator. Assign the Administrator role to another user first.');
            }
        });
    }

    /**
     * Whether this change strips the Administrator role from the last user
     * holding it.
     */
    protected function wouldRemoveLastAdministrator(\App\Models\User $target, $newRoleId): bool
    {
        $currentRole = $target->role;

        if (! $currentRole || ! in_array($currentRole->role_name, Role::ADMIN_ROLES, true)) {
            return false; // They are not an administrator, so none is lost.
        }

        $newRole = $newRoleId ? Role::find($newRoleId) : null;

        if ($newRole && in_array($newRole->role_name, Role::ADMIN_ROLES, true)) {
            return false; // Still an administrator afterwards.
        }

        $adminRoleIds = Role::whereIn('role_name', Role::ADMIN_ROLES)->pluck('role_id');

        return \App\Models\User::whereIn('role_id', $adminRoleIds)->count() <= 1;
    }
}
