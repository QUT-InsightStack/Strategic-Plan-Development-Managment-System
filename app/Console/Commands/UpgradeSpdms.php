<?php

namespace App\Console\Commands;

use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RolesSeeder;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;

class UpgradeSpdms extends Command
{
    use ConfirmableTrait;

    protected $signature = 'spdms:upgrade {--force : Run against a production environment}';

    protected $description = 'Apply schema and permission updates without running demo user seeders';

    public function handle(): int
    {
        if (! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        if ($this->call('migrate', ['--force' => true]) !== self::SUCCESS) {
            return self::FAILURE;
        }

        foreach ([RolesSeeder::class, PermissionSeeder::class, RolePermissionSeeder::class] as $seeder) {
            if ($this->call('db:seed', ['--class' => $seeder, '--force' => true]) !== self::SUCCESS) {
                return self::FAILURE;
            }
        }

        $this->info('Schema and permissions updated. Existing account credentials were preserved.');

        return self::SUCCESS;
    }
}
