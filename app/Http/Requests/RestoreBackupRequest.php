<?php

namespace App\Http\Requests;

class RestoreBackupRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['backups.restore'];
    }

    public function rules(): array
    {
        return [];
    }
}
