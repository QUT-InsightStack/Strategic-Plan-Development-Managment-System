<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Permission extends Model
{
    use HasFactory;

    protected $table      = 'tblpermissions';
    protected $primaryKey = 'permission_id';

    protected $fillable = [
        'permission_name',
        'description',
        'code',
        'module',
    ];

    public function roles(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(
            Role::class,
            'tblrole_permissions',
            'permission_id',
            'role_id'
        );
    }
}