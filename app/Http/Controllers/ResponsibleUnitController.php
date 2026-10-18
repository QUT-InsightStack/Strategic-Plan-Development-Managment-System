<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssignResponsibleUnitRequest;
use App\Http\Requests\ListObjectiveFeedbackRequest;
use App\Models\ResponsibleUnit;
use App\Services\PermissionAuthorizationService;
use App\Services\ResponsibleUnitService;
use Illuminate\Http\JsonResponse;

class ResponsibleUnitController extends Controller
{
    public function index(ListObjectiveFeedbackRequest $request, PermissionAuthorizationService $permissions): JsonResponse
    {
        $permissions->ensureHasPermission('strategic_objectives.view');
        $units = ResponsibleUnit::where('is_active', true)->orderBy('responsible_office_agency')
            ->orderBy('responsible_unit_id')->paginate($request->validated('per_page', 25));

        return response()->json(['success' => true, 'data' => $units->items(), 'meta' => [
            'current_page' => $units->currentPage(), 'last_page' => $units->lastPage(),
            'per_page' => $units->perPage(), 'total' => $units->total(),
        ]]);
    }

    public function assign(AssignResponsibleUnitRequest $request, ResponsibleUnitService $service, ?int $id = null): JsonResponse
    {
        $data = $request->validated();
        $objectives = $service->assign($id === null ? $data['objective_ids'] : [$id], $data, $request->user('api'));

        return response()->json([
            'success' => true, 'message' => 'Responsible unit assigned successfully.',
            'data' => $id === null ? $objectives : $objectives->first(),
        ]);
    }
}
