<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StoreRelationRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $recordId = $this->input('record_id');
        $parentId = $this->input('parent_id');

        return [
            'record_id' => [
                'required',
                'integer',
                Rule::exists('tblstrategic_record', 'record_id'),
                Rule::notIn([$parentId]),   // record cannot equal parent
            ],
            'parent_id' => [
                'required',
                'integer',
                Rule::exists('tblstrategic_record', 'record_id'),
                Rule::notIn([$recordId]),   // parent cannot equal record
                Rule::unique('tblrelation_map')->where('record_id', $recordId),
            ],
            'created_by' => ['required', 'integer', Rule::exists('tblusers', 'user_id')],
        ];
    }
}