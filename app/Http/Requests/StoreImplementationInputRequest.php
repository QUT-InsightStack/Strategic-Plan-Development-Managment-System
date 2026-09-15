<?php

namespace App\Http\Requests;

use App\Models\ImplementationInput;
use App\Services\PermissionAuthorizationService;
use Illuminate\Validation\Rule;

class StoreImplementationInputRequest extends StoreObjectiveFeedbackRequest
{
    public function authorize(): bool
    {
        app(PermissionAuthorizationService::class)->ensureHasPermission('implementation_inputs.create');

        return true;
    }

    public function rules(): array
    {
        return array_replace($this->feedbackRules(), [
            'content' => ['required', 'string', 'max:20000', 'regex:/\S/u'],
            'input_type' => ['required', 'string', Rule::in(ImplementationInput::TYPES)],
            'objective_id' => $this->route('objectiveId') !== null
                ? ['missing'] : ['sometimes', 'nullable', 'integer', 'min:1'],
        ]);
    }
}
