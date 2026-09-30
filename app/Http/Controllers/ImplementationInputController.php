<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListImplementationInputsRequest;
use App\Http\Requests\ReviewImplementationInputRequest;
use App\Http\Requests\StoreImplementationInputRequest;
use App\Services\ImplementationInputQueryService;
use App\Services\ObjectiveCollaborationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ImplementationInputController extends Controller
{
    public function __construct(
        private readonly ObjectiveCollaborationService $service,
        private readonly ImplementationInputQueryService $queries,
    ) {}

    public function index(ListImplementationInputsRequest $request): JsonResponse
    {
        $filters = $request->validated();
        foreach (['planId' => 'plan_id', 'objectiveId' => 'objective_id'] as $route => $field) {
            if ($request->route($route) !== null) {
                abort_if(isset($filters[$field]) && (int) $filters[$field] !== (int) $request->route($route), 422, 'Conflicting route and filter.');
                $filters[$field] = $request->route($route);
            }
        }

        return response()->json($this->queries->listing($filters, $request->user('api')));
    }

    public function show(Request $request, int $inputId): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->queries->show($inputId, $request->user('api'))]);
    }

    public function review(ReviewImplementationInputRequest $request, int $inputId): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->queries->review($inputId, $request->validated(), $request->user('api'))]);
    }

    public function store(StoreImplementationInputRequest $request): JsonResponse
    {
        $input = $this->service->submitInput(
            $request->route('planId'), $request->route('objectiveId') ?? $request->validated('objective_id'),
            $request->validated(), $request->user('api'),
        );

        return response()->json(['success' => true, 'message' => 'Input submitted successfully.', 'data' => $input], 201);
    }
}
