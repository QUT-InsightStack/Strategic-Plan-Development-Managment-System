<?php

namespace App\Http\Requests;

use App\Validation\AuthValidationRules;
use App\Validation\ValidationAttributes;

class LoginRequest extends ApiFormRequest
{
    /**
     * Login is public — no auth needed to reach this endpoint.
     */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => mb_strtolower(trim($this->input('email')))]);
        }
    }

    public function rules(): array
    {
        return [
            'email'    => AuthValidationRules::loginEmail(),
            'password' => AuthValidationRules::loginPassword(),
        ];
    }

    /**
     * Friendly field names for error messages.
     */
    public function attributes(): array
    {
        return ValidationAttributes::all();
    }

    protected function prepareForValidation(): void
{
    $email = $this->input('email');

    if (is_string($email)) {
        $this->merge([
            'email' => mb_strtolower(trim($email)),
        ]);
    }
}
}
