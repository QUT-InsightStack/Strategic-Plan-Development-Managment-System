<?php

namespace App\Services;

use App\Models\SecuritySetting;
use App\Models\User;

class SecuritySettingsService
{
    public const DEFAULTS = [
        'session_timeout_minutes' => 30,
        'max_failed_login_attempts' => 3,
        'lockout_duration_minutes' => 120,
    ];

    public function all(): array
    {
        $values = SecuritySetting::query()->pluck('value', 'key')->all();
        return array_map(fn (string $key): int => (int) ($values[$key] ?? self::DEFAULTS[$key]), array_keys(self::DEFAULTS));
    }

    public function get(string $key): int
    {
        return $this->all()[$key] ?? self::DEFAULTS[$key];
    }

    public function update(array $values): array
    {
        foreach ($values as $key => $value) {
            SecuritySetting::query()->updateOrCreate(['key' => $key], ['value' => $value]);
        }

        return $this->all();
    }

    public function technicalAdmin(User $user): bool
    {
        return in_array($user->role?->role_name, ['Technical Administrator', 'Technical Admin', 'test'], true);
    }
}