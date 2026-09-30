<?php

namespace App\Services;

use App\Models\ApprovalWorkflow;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ApprovalWorkflowService
{
    public function authorize(User $actor): void
    {
        abort_unless($actor->status === 'active' && in_array($actor->role?->role_name, Role::PRIVILEGED_ROLES, true),
            403, 'Only authorised administrators may configure approval workflows.');
    }

    public function save(array $payload, User $actor): ApprovalWorkflow
    {
        $this->authorize($actor);

        return DB::transaction(function () use ($payload) {
            $workflow = ApprovalWorkflow::lockForUpdate()->findOrFail(1);
            $data = $this->validate($payload);
            abort_unless((int) $data['version'] === (int) $workflow->version, 409,
                'The workflow was changed by another administrator. Reload before saving.');
            $workflow->update([
                'name' => trim($data['name']), 'description' => $data['description'] ?? null,
                'status' => $data['status'], 'version' => $workflow->version + 1,
            ]);
            $workflow->stages()->delete();
            $workflow->stages()->createMany($data['stages']);

            return $workflow->load('stages');
        });
    }

    public function validate(array $payload): array
    {
        $data = Validator::make($payload, [
            'name' => ['required', 'string', 'max:255', 'regex:/\S/'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['required', Rule::in(['draft', 'active', 'inactive'])],
            'version' => ['required', 'integer', 'min:0'],
            'stages' => ['required', 'array', 'min:1', 'max:50'],
            'stages.*' => ['required', 'array:name,sequence,user_id,role_id'],
            'stages.*.name' => ['required', 'string', 'max:255', 'regex:/\S/'],
            'stages.*.sequence' => ['required', 'integer', 'min:1', 'distinct'],
            'stages.*.user_id' => ['nullable', 'integer', Rule::exists('tblusers', 'user_id')->where('status', 'active')],
            'stages.*.role_id' => ['nullable', 'integer', Rule::exists('tblroles', 'role_id')],
        ])->validate();
        $sequences = array_map('intval', array_column($data['stages'], 'sequence'));
        sort($sequences);
        if ($sequences !== range(1, count($data['stages']))) {
            throw ValidationException::withMessages(['stages' => 'Stage sequence must start at 1 and have no gaps.']);
        }
        foreach ($data['stages'] as $index => $stage) {
            if (empty($stage['user_id']) === empty($stage['role_id'])) {
                throw ValidationException::withMessages(["stages.$index" => 'Assign exactly one active user or role to each stage.']);
            }
            if ($this->reviewers($stage)->isEmpty()) {
                throw ValidationException::withMessages(["stages.$index" => 'Every stage must have at least one active approver.']);
            }
        }

        return $data;
    }

    public function reviewers(array $stage)
    {
        return User::where('status', 'active')
            ->when(! empty($stage['user_id']), fn ($query) => $query->where('user_id', $stage['user_id']),
                fn ($query) => $query->where('role_id', $stage['role_id'] ?? null))
            ->orderBy('user_id')->get(['user_id', 'first_name', 'last_name']);
    }
}
