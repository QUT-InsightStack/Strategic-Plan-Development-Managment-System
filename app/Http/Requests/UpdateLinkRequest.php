<?php

namespace App\Http\Requests;

use App\Models\Link;
use Illuminate\Validation\Rule;

class UpdateLinkRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Route::apiResource('plan-core-values', ...) → parameter name: {plan_core_value}
        $linkId   = $this->route('plan_core_value');
        $existing = Link::find($linkId);

        $planId = $this->input('plan_id', $existing?->plan_id);

        return [
            'core_value_id' => [
                'sometimes',
                'integer',
                Rule::exists('tblstrategic_foundations', 'foundation_id')
                    ->where('type', 'CORE_VALUE'),
                Rule::unique('tblplan_core_value')
                    ->where('plan_id', $planId)
                    ->ignore($linkId, 'link_id'),
            ],
            'plan_id'    => ['sometimes', 'integer', Rule::exists('tblstrategic_record', 'record_id')],
            'created_by' => ['sometimes', 'integer', Rule::exists('tblusers', 'user_id')],
            'updated_by' => ['sometimes', 'integer', Rule::exists('tblusers', 'user_id')],
        ];
    }
}