<?php

namespace App\Http\Requests;

use Illuminate\Validation\Rule;

class StorePresidentialAgendaItemRequest extends ApiFormRequest
{
    protected function requiredPermissions(): array
    {
        return ['presidential_agenda.manage'];
    }

    public function rules(): array
    {
        return [
            'code' => [
                'required',
                'string',
                'max:50',
                Rule::unique('tblpresidential_agenda_items', 'code'),
            ],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string'],
            'effective_date' => ['nullable', 'date_format:Y-m-d'],
            'note' => ['nullable', 'string'],

            'agenda_id' => ['prohibited'],
            'status' => ['prohibited'],
            'created_by' => ['prohibited'],
            'updated_by' => ['prohibited'],
            'archived_at' => ['prohibited'],
            'archived_by' => ['prohibited'],
            'deleted_at' => ['prohibited'],
            'deleted_by' => ['prohibited'],
        ];
    }
}