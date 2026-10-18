<?php

namespace App\Http\Controllers;

use App\Models\ApprovalWorkflow;
use App\Models\Role;
use App\Models\User;
use App\Services\ApprovalWorkflowService;
use Illuminate\Http\Request;

class ApprovalWorkflowController extends Controller
{
    public function __construct(
        private ApprovalWorkflowService $service
    ) {}

    public function show(Request $request)
    {
        $this->service->authorize($request->user('api'));

        $selection = $request->validate([
            'workflow_id' => ['sometimes', 'integer', 'min:1'],
        ]);

        $workflows = ApprovalWorkflow::with('stages')
            ->orderBy('id')
            ->get();

        $selected = isset($selection['workflow_id'])
            ? $workflows->firstWhere('id', (int) $selection['workflow_id'])
            : (
                $workflows->firstWhere('status', 'active')
                ?? $workflows->first()
            );

        abort_if(! $selected, 404, 'Approval workflow not found.');

        return response()->json([
            'data' => $selected,
            'workflows' => $workflows,
            'active_workflow_id' => $workflows
                ->firstWhere('status', 'active')?->id,
            'options' => [
                'users' => User::where('status', 'active')
                    ->orderBy('first_name')
                    ->get(['user_id', 'first_name', 'last_name']),
                'roles' => Role::whereHas(
                    'users',
                    fn ($query) => $query->where('status', 'active')
                )
                    ->orderBy('role_name')
                    ->get(['role_id', 'role_name']),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $this->service->authorize($request->user('api'));

        $workflow = $this->service->save(
            $request->all(),
            $request->user('api'),
            null
        );

        return response()->json(['data' => $workflow], 201);
    }

    public function update(Request $request)
    {
        $this->service->authorize($request->user('api'));

        $selection = $request->validate([
            'workflow_id' => ['sometimes', 'integer', 'min:1'],
        ]);

        // Preserve existing callers that update workflow 1.
        $workflow = $this->service->save(
            $request->all(),
            $request->user('api'),
            (int) ($selection['workflow_id'] ?? 1)
        );

        return response()->json(['data' => $workflow]);
    }
}