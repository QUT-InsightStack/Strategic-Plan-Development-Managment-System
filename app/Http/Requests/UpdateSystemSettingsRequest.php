<?php

namespace App\Http\Requests;

use App\Models\SystemSetting;
use Illuminate\Validation\Validator;

class UpdateSystemSettingsRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['settings.manage'];
    }

    public function rules(): array
    {
        return [
            'login_lockout_minutes' => ['sometimes', 'required', 'integer', 'between:1,1440'],
            'session_idle_timeout_minutes' => [
                'sometimes',
                'required',
                'integer',
                'between:5,120',
            ],
            'login_attempt_limit' => [
                'sometimes',
                'required',
                'integer',
                'between:3,10',
            ],
            'maintenance_enabled' => [
                'sometimes',
                'required',
                'boolean',
            ],
            'password_min_length' => [
                'sometimes',
                'required',
                'integer',
                'between:15,64',
            ],
            'password_require_mixed_case' => [
                'sometimes',
                'required',
                'boolean',
            ],
            'password_require_numbers' => [
                'sometimes',
                'required',
                'boolean',
            ],
            'password_require_symbols' => [
                'sometimes',
                'required',
                'boolean',
            ],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $input = $this->all();

            foreach (array_diff(array_keys($input), SystemSetting::EDITABLE) as $key) {
                $validator->errors()->add(
                    (string) $key,
                    'This setting is not supported.'
                );
            }

            if (array_intersect(array_keys($input), SystemSetting::EDITABLE) === []) {
                $validator->errors()->add(
                    'settings',
                    'Submit at least one supported setting.'
                );
            }

            /*
             * Require real JSON scalar types rather than coercing strings
             * such as "false" or numeric strings.
             */
            foreach ([
                'maintenance_enabled',
                'password_require_mixed_case',
                'password_require_numbers',
                'password_require_symbols',
            ] as $key) {
                if (array_key_exists($key, $input) && ! is_bool($input[$key])) {
                    $validator->errors()->add($key, 'The value must be a boolean.');
                }
            }

            foreach ([
                'session_idle_timeout_minutes',
                'login_attempt_limit',
                'login_lockout_minutes',
                'password_min_length',
            ] as $key) {
                if (array_key_exists($key, $input) && ! is_int($input[$key])) {
                    $validator->errors()->add($key, 'The value must be an integer.');
                }
            }
        });
    }
}
