<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListObjectiveFeedbackRequest;
use App\Http\Requests\StoreObjectiveCommentRequest;
use App\Services\ObjectiveCollaborationService;
use Illuminate\Http\JsonResponse;

class ObjectiveCommentController extends Controller
{
    public function __construct(private readonly ObjectiveCollaborationService $service) {}

    public function index(ListObjectiveFeedbackRequest $request, int $objectiveId): JsonResponse
    {
        $comments = $this->service->comments($objectiveId, $request->validated('per_page', 25), $request->user('api'));

        return response()->json(['success' => true, 'data' => $comments->items(), 'meta' => [
            'current_page' => $comments->currentPage(), 'last_page' => $comments->lastPage(),
            'per_page' => $comments->perPage(), 'total' => $comments->total(),
        ]]);
    }

    public function store(StoreObjectiveCommentRequest $request, int $objectiveId): JsonResponse
    {
        $comment = $this->service->addComment($objectiveId, $request->validated('content'), $request->user('api'));

        return response()->json(['success' => true, 'message' => 'Comment saved successfully.', 'data' => $comment], 201);
    }
}
