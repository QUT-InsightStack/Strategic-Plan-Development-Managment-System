<?php

namespace App\Http\Requests;

use App\Models\Relation;
use Illuminate\Validation\Rule;

class UpdateRelationRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $relationId = $this->route('relation');
        $existing   = Relation::find($relationId);

        // Fall back to existing DB values when a field is not being changed
        $recordId = $this->input('record_id', $existing?->record_id);
        $parentId = $this->input('parent_id', $existing?->parent_id);

        return [
            'record_id' => [
                'sometimes',
                'integer',
                Rule::exists('tblstrategic_record', 'record_id'),
                Rule::notIn([$parentId]),
            ],
            'parent_id' => [
                'sometimes',
                'integer',
                Rule::exists('tblstrategic_record', 'record_id'),
                Rule::notIn([$recordId]),
                Rule::unique('tblrelation_map')
                    ->where('record_id', $recordId)
                    ->ignore($relationId, 'relation_id'),
            ],
            'created_by' => ['sometimes', 'integer', Rule::exists('tblusers', 'user_id')],
        ];
    }
}