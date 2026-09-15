<?php

namespace App\Repositories;

use App\Models\SystemSetting;

class SystemSettingRepository
{
    public function get(bool $lock = false): SystemSetting
    {
        $query = SystemSetting::query();

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->findOrFail(1);
    }

    public function save(SystemSetting $settings): void
    {
        $settings->saveOrFail();
    }
}