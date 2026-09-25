<?php

namespace App\Http\Controllers;

use App\Models\ApprovalWorkflow;
use App\Models\Role;
use App\Models\User;
use App\Services\ApprovalWorkflowService;
use Illuminate\Http\Request;

class ApprovalWorkflowController extends Controller
{
    public function __construct(private ApprovalWorkflowService $service) {}

    public function show(Request $request)
    {
        $this->service->authorize($request->user('api'));

        return response()->json(['data' => ApprovalWorkflow::with('stages')->findOrFail(1), 'options' => [
            'users' => User::where('status', 'active')->orderBy('first_name')->get(['user_id', 'first_name', 'last_name']),
            'roles' => Role::whereHas('users', fn ($query) => $query->where('status', 'active'))->orderBy('role_name')->get(['role_id', 'role_name']),
        ]]);
    }

    public function update(Request $request)
    {
        return response()->json(['data' => $this->service->save($request->all(), $request->user('api'))]);
    }
}
