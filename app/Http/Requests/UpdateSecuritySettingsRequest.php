<?php

namespace App\Http\Requests;

class UpdateSecuritySettingsRequest extends UpdateSystemSettingsRequest
{
    protected function prepareForValidation(): void
    {
        $aliases = [
            'session_timeout_minutes' => 'session_idle_timeout_minutes',
            'max_failed_login_attempts' => 'login_attempt_limit',
            'lockout_duration_minutes' => 'login_lockout_minutes',
        ];
        $input = $this->all();
        foreach ($aliases as $old => $new) {
            if (! array_key_exists($old, $input)) {
                continue;
            }
            if (array_key_exists($new, $input) && $input[$new] !== $input[$old]) {
                throw \Illuminate\Validation\ValidationException::withMessages([$old => ['Conflicting setting values.']]);
            }
            $input[$new] = $input[$old];
            unset($input[$old]);
        }
        $this->replace($input);
    }
}
