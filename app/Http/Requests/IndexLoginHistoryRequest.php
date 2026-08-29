<?php

namespace App\Http\Requests;

use App\Models\LoginHistory;
use Illuminate\Validation\Rule;

class IndexLoginHistoryRequest extends ApiFormRequest
{
    /**
     * Login history across all accounts is security-log territory, so it sits
     * behind the same permission as the rest of the activity log.
     */
    protected function requiredPermissions(): array
    {
        return ['logs.view'];
    }

    public function rules(): array
    {
        return [
            'user_id' => ['sometimes', 'nullable', 'integer', Rule::exists('tblusers', 'user_id')],
            'outcome' => ['sometimes', 'nullable', Rule::in([
                LoginHistory::OUTCOME_SUCCESS,
                LoginHistory::OUTCOME_FAILED,
            ])],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'from' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'to.after_or_equal' => 'The end date must be on or after the start date.',
        ];
    }
}
