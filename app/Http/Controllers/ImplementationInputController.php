<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListObjectiveFeedbackRequest;
use App\Http\Requests\StoreImplementationInputRequest;
use App\Services\ObjectiveCollaborationService;
use Illuminate\Http\JsonResponse;

class ImplementationInputController extends Controller
{
    public function __construct(private readonly ObjectiveCollaborationService $service) {}

    public function index(ListObjectiveFeedbackRequest $request): JsonResponse
    {
        $inputs = $this->service->inputs(
            $request->route('planId'), $request->route('objectiveId'),
            $request->validated('per_page', 25), $request->user('api'),
        );

        return response()->json(['success' => true, 'data' => $inputs->items(), 'meta' => [
            'current_page' => $inputs->currentPage(), 'last_page' => $inputs->lastPage(),
            'per_page' => $inputs->perPage(), 'total' => $inputs->total(),
        ]]);
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
