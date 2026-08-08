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
     * Roles permitted to administer users and role assignments.
     *
     * Defined here as the single source of truth so authorisation checks and
     * the seeder cannot drift apart. Must match RolesSeeder.
     */
    public const ADMIN_ROLES = ['Administrator'];

    /**
     * Roles that grant administrative privilege. Assigning one is treated as
     * privilege escalation and is restricted accordingly.
     */
    public const PRIVILEGED_ROLES = ['Administrator'];

    protected $fillable = [
        'role_name',
        'description',
    ];

    /**
     * Whether this role grants administrative privilege.
     */
    public function isPrivileged(): bool
    {
        return in_array($this->role_name, self::PRIVILEGED_ROLES, true);
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