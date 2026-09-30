<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Role extends Model
{
    use HasFactory;

    protected $table      = 'tblroles';
    protected $primaryKey = 'role_id';

    /**
     * Roles counted by the last-administrator safeguards. A test account
     * must not replace the last real Administrator.
     */
    public const ADMIN_ROLES = ['Administrator'];

    /**
     * Roles that grant administrative privilege. Assigning one is treated as
     * privilege escalation and is restricted accordingly.
     */
    public const PRIVILEGED_ROLES = ['Administrator', 'Technical Administrator', 'Technical Admin', 'test'];

    public const FULL_ACCESS_ROLES = ['Administrator', 'test'];

    protected $fillable = [
        'role_name',
        'description',
        'is_assignable',
        'is_protected',

    ];

    public function hasFullAccess(): bool
    {
        return in_array($this->role_name, self::FULL_ACCESS_ROLES, true);
    }

    /**
     * Whether this role grants administrative privilege.
     */
    public function isPrivileged(): bool
    {
        return in_array($this->role_name, self::PRIVILEGED_ROLES, true);
    }

    protected function casts(): array
    {
        return [
            'is_assignable' => 'boolean',
            'is_protected' => 'boolean',
        ];
    }

    public function users(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(User::class, 'role_id', 'role_id');
    }

    public function permissions(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(
            Permission::class,
            'tblrole_permissions',
            'role_id',
            'permission_id'
        );
    }
}
