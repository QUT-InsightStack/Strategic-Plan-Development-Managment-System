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
            'feedback_category' => [
    'sometimes', 'nullable',
    Rule::in(ImplementationInput::FEEDBACK_CATEGORIES),
],
'mapping_type' => [
    'required_if:feedback_category,mapping_feedback',
    'prohibited_unless:feedback_category,mapping_feedback',
    Rule::in(['pdp-chapter', 'presidential-agenda']),
],
'mapping_reference_id' => [
    'required_if:feedback_category,mapping_feedback',
    'prohibited_unless:feedback_category,mapping_feedback',
    'integer', 'min:1',
],
'mapping_reference_title' => ['missing'],
            'objective_id' => $this->route('objectiveId') !== null
                ? ['missing'] : ['sometimes', 'nullable', 'integer', 'min:1'],
        ]);
    }
}
