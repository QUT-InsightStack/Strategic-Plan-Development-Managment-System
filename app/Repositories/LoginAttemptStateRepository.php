<?php

namespace App\Repositories;

use App\Models\LoginAttemptState;

class LoginAttemptStateRepository
{
    /**
     * Call inside a transaction.
     *
     * insertOrIgnore handles concurrent creation of the same identifier row.
     */
    public function getLocked(string $hash): LoginAttemptState
    {
        LoginAttemptState::query()->insertOrIgnore([
            'identifier_hash' => $hash,
            'failed_attempts' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return LoginAttemptState::query()
            ->lockForUpdate()
            ->findOrFail($hash);
    }

    public function save(LoginAttemptState $state): void
    {
        $state->saveOrFail();
    }
}