<?php

namespace App\Http\Requests;

class LoginRequest extends ApiFormRequest
{
    /**
     * Login is public — no auth needed to reach this endpoint.
     */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email'    => ['required', 'string', 'email', 'max:255'],
            'password' => ['required', 'string'],
        ];
    }

    /**
     * Friendly field names for error messages.
     */
    public function attributes(): array
    {
        return [
            'email'    => 'email address',
            'password' => 'password',
        ];
    }
}