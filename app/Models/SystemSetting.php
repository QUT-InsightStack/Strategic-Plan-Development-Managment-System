<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    protected $table = 'tblsystem_settings';

    public $incrementing = false;

    public const EDITABLE = [
        'session_idle_timeout_minutes',
        'login_attempt_limit',
        'login_lockout_minutes',
        'maintenance_enabled',
        'password_min_length',
        'password_require_mixed_case',
        'password_require_numbers',
        'password_require_symbols',
    ];

    protected $fillable = self::EDITABLE;

    protected function casts(): array
    {
        return [
            'session_idle_timeout_minutes' => 'integer',
            'login_attempt_limit' => 'integer',
            'login_lockout_minutes' => 'integer',
            'maintenance_enabled' => 'boolean',
            'password_min_length' => 'integer',
            'password_require_mixed_case' => 'boolean',
            'password_require_numbers' => 'boolean',
            'password_require_symbols' => 'boolean',
        ];
    }

    public function values(): array
    {
        return $this->only(self::EDITABLE);
    }
}
