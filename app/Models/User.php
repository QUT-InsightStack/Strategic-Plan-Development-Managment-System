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
        'first_name',
        'last_name',
        'department',
        'email',
        'password',
        'role_id',
        'status',
        'mobile',
        'address',
        'gender',
        'date_of_birth',
        'profile_picture',
        'unit',
        'office',
        'position',

    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'date_of_birth'     => 'date',
            'gender'            => 'boolean',
            'password'          => 'hashed',
        ];
    }

    // Accessor for name (combines first_name and last_name)
    public function getNameAttribute(): string
    {
        return trim($this->first_name . ' ' . $this->last_name);
    }

    // Mutator for name (splits into first_name and last_name)
    public function setNameAttribute(string $value): void
    {
        $parts = explode(' ', $value, 2);
        $this->first_name = $parts[0] ?? '';
        $this->last_name = $parts[1] ?? '';
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