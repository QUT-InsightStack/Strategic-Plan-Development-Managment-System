<?php

namespace App\Repositories;

use App\Models\AuthSession;

class AuthSessionRepository
{
    public function create(array $data): AuthSession
    {
        return AuthSession::query()->create($data);
    }

    public function findLocked(string $id): ?AuthSession
    {
        return AuthSession::query()
            ->lockForUpdate()
            ->find($id);
    }

    public function save(AuthSession $session): void
    {
        $session->saveOrFail();
    }
}