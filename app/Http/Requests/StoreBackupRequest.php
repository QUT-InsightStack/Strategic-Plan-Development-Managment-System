<?php

namespace App\Http\Requests;

class StoreBackupRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['backups.create'];
    }

    /**
     * A backup takes no input. The filename and contents are decided entirely
     * by the server, so there is nothing here for a caller to influence.
     */
    public function rules(): array
    {
        return [];
    }
}
