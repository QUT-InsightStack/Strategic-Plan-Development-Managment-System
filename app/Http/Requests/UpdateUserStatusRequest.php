<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class UpdateUserStatusRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['users.update'];
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', Rule::in(['active', 'inactive', 'suspended'])],
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }
}
