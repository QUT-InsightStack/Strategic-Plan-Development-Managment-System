<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable;

    protected $table      = 'tblusers';
    protected $primaryKey = 'user_id';

    protected $fillable = [
        'name',
        'department',
        'email',
        'password',
        'role_id',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password'          => 'hashed',
        ];
    }

    // ─── JWTSubject interface — required by tymon/jwt-auth ───────────────────

    /**
     * The value JWT uses.
     * Returns the user's primary key.
     */
    public function getJWTIdentifier(): mixed
    {
        return $this->getKey();
    }

    /**
     * Extra claims merged into the JWT payload.
     * Person A's RoleMiddleware can read the role directly from the token — no DB query needed.
     */
    public function getJWTCustomClaims(): array
    {
        return [
            'role_id'   => $this->role_id,
            'role_name' => $this->role?->role_name,
        ];
    }

    // ─── Relationships ───────────────────────────────────────────────────────

    public function role(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id', 'role_id');
    }
}