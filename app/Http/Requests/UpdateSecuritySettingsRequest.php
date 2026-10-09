<?php

namespace App\Http\Requests;

class UpdateSecuritySettingsRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'session_timeout_minutes' => ['required', 'integer', 'min:1'],
            'max_failed_login_attempts' => ['required', 'integer', 'min:1'],
            'lockout_duration_minutes' => ['required', 'integer', 'min:1'],
        ];
    }
}