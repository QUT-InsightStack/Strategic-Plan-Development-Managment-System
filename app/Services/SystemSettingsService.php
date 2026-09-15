<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\SystemSetting;
use App\Repositories\SystemSettingRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SystemSettingsService
{
    public function __construct(
        private readonly SystemSettingRepository $repository,
        private readonly PermissionAuthorizationService $authorization,
        private readonly StrategicLogWriter $logWriter
    ) {
    }

    /**
     * Internal runtime read, without administrative authorization.
     * No cross-request caching.
     */
    public function current(): SystemSetting
    {
        return $this->repository->get();
    }

    public function show(): SystemSetting
    {
        $this->authorization->ensureHasPermission('settings.view');

        return $this->current();
    }

    public function update(array $data): array
    {
        $actor = $this->authorization->ensureHasPermission('settings.manage');

        if (
            $data === []
            || array_diff(array_keys($data), SystemSetting::EDITABLE) !== []
        ) {
            throw ValidationException::withMessages([
                'settings' => ['Submit only supported settings.'],
            ]);
        }

        return DB::transaction(function () use ($data, $actor): array {
            $settings = $this->repository->get(lock: true);
            $before = $settings->values();

            $settings->fill($data);

            $changedKeys = array_values(array_intersect(
                array_keys($settings->getDirty()),
                SystemSetting::EDITABLE
            ));

            if ($changedKeys === []) {
                return [
                    'settings' => $settings,
                    'changed' => false,
                ];
            }

            $this->repository->save($settings);

            $changes = [];

            foreach ($changedKeys as $key) {
                $changes[$key] = [
                    'old' => $before[$key],
                    'new' => $settings->{$key},
                ];
            }

            $this->logWriter->write('system_settings.updated', [
                'actor_user_id' => $actor->user_id,
                'resource_type' => 'system_settings',
                'resource_id' => 1,
                'changes' => $changes,
            ]);

            return [
                'settings' => $settings,
                'changed' => true,
            ];
        });
    }
}