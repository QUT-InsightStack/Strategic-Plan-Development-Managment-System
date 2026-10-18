<?php

namespace App\Http\Controllers;

use App\Models\ManagementObjectiveComment;
use App\Models\User;
use App\Services\ManagementObjectiveCommentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ManagementObjectiveCommentController extends Controller
{
    public function __construct(
        private readonly ManagementObjectiveCommentService $service
    ) {}

    private function present(
        ManagementObjectiveComment $comment,
        User $actor
    ): array {
        $comment->loadMissing([
            'strategicPlan:record_id,title,status,approval_status',
            'objective:objective_id,strategic_plan_id,objective_title,status',
        ]);

        return [
            ...$comment->toArray(),
            ...$this->service->capabilities($comment, $actor),
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $actor = $request->user('api');
        $query = $this->service->query($actor);

        $filters = $request->validate([
            'plan_id' => ['sometimes', 'integer', 'min:1'],
            'objective_id' => ['sometimes', 'integer', 'min:1'],
            'acknowledgement_status' => [
                'sometimes',
                Rule::in(['not_acknowledged', 'acknowledged']),
            ],
            'completion_status' => [
                'sometimes',
                Rule::in(['open', 'completed', 'incomplete']),
            ],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ]);

        foreach ([
            'plan_id' => 'strategic_plan_id',
            'objective_id' => 'objective_id',
            'acknowledgement_status' => 'acknowledgement_status',
            'completion_status' => 'completion_status',
        ] as $filter => $column) {
            if (isset($filters[$filter])) {
                $query->where($column, $filters[$filter]);
            }
        }

        $page = $query->orderByDesc('comment_id')
            ->paginate($filters['per_page'] ?? 10);

        return response()->json([
            'success' => true,
            'data' => $page->getCollection()
                ->map(fn ($comment) => $this->present($comment, $actor))
                ->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
        ]);
    }

    public function show(Request $request, int $commentId): JsonResponse
    {
        $actor = $request->user('api');
        $comment = $this->service->find($commentId, $actor);

        return response()->json([
            'success' => true,
            'data' => $this->present($comment, $actor),
        ]);
    }

    public function store(Request $request, int $objectiveId): JsonResponse
    {
        $data = $request->validate([
            'content' => ['required', 'string', 'max:10000', 'regex:/\S/u'],
        ]);

        $actor = $request->user('api');
        $comment = $this->service->create(
            $objectiveId,
            $data['content'],
            $actor
        );

        return response()->json([
            'success' => true,
            'message' => 'Management comment added.',
            'data' => $this->present($comment, $actor),
        ], 201);
    }

    public function acknowledge(
        Request $request,
        int $commentId
    ): JsonResponse {
        $actor = $request->user('api');
        $comment = $this->service->acknowledge($commentId, $actor);

        return response()->json([
            'success' => true,
            'message' => 'Comment acknowledged. Completion remains Open.',
            'data' => $this->present($comment, $actor),
        ]);
    }

    public function close(Request $request, int $commentId): JsonResponse
    {
        $data = $request->validate([
            'completion_status' => [
                'required',
                Rule::in(['completed', 'incomplete']),
            ],
            'closing_remarks' => [
                'required',
                'string',
                'max:5000',
                'regex:/\S/u',
            ],
        ]);

        $actor = $request->user('api');
        $comment = $this->service->close(
            $commentId,
            $data['completion_status'],
            $data['closing_remarks'],
            $actor
        );

        return response()->json([
            'success' => true,
            'message' => 'Management comment closed.',
            'data' => $this->present($comment, $actor),
        ]);
    }
}