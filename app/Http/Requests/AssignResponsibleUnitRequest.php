<?php

namespace App\Http\Requests;

use App\Services\PermissionAuthorizationService;
use Illuminate\Validation\Rule;

class AssignResponsibleUnitRequest extends ApiFormRequest
{
    public function authorize(): bool
    {
        app(PermissionAuthorizationService::class)->ensureHasPermission('strategic_objectives.assign_responsible_unit');

        return true;
    }

    public function rules(): array
    {
        return [
            'objective_ids' => $this->route('id') === null
                ? ['required', 'array', 'min:1', 'max:100'] : ['missing'],
            'objective_ids.*' => ['required', 'integer', 'min:1', 'distinct'],
            'responsible_unit_id' => ['required_without:responsible_office_agency', 'prohibits:responsible_office_agency', 'integer',
                Rule::exists('tblresponsible_units', 'responsible_unit_id')->where('is_active', true)],
            'responsible_office_agency' => ['required_without:responsible_unit_id', 'prohibits:responsible_unit_id', 'string', 'max:255'],
            'assigned_by' => ['missing'],
            'created_at' => ['missing'],
            'updated_at' => ['missing'],
        ];
    }
}
