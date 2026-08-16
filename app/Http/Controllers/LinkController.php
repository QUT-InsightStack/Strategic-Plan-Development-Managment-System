<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreLinkRequest;
use App\Http\Requests\UpdateLinkRequest;
use App\Services\LinkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LinkController extends Controller
{
    protected $linkService;

    public function __construct(LinkService $linkService)
    {
        $this->linkService = $linkService;
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'plan_id' => [
                'nullable',
                'integer',
                Rule::exists('tblstrategic_record', 'record_id')->where(
                    fn ($query) => $query->where('status', '!=', 'deleted')
                ),
            ],
            'core_value_id' => [
                'nullable',
                'integer',
                Rule::exists('tblstrategic_foundations', 'foundation_id')->where(
                    fn ($query) => $query->where('type', 'CORE_VALUE')->where('status', '!=', 'deleted')
                ),
            ],
        ]);

        return response()->json([
            'data' => $this->linkService->getAll($filters),
        ], 200);
    }

    public function show(int $id): JsonResponse
    {
        $link = $this->linkService->getById($id);

        if (! $link) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['data' => $link], 200);
    }

    public function store(StoreLinkRequest $request): JsonResponse
    {
        $link = $this->linkService->create($request->validated());

        return response()->json(['message' => 'Created', 'data' => $link], 201);
    }

    public function update(UpdateLinkRequest $request, int $id): JsonResponse
    {
        $updated = $this->linkService->update($id, $request->validated());

        if (! $updated) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        return response()->json(['message' => 'Updated', 'data' => $updated], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $deleted = $this->linkService->delete($id);

        if (! $deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['message' => 'Deleted'], 200);
    }

    public function byPlan(int $planId): JsonResponse
    {
        return response()->json([
            'data' => $this->linkService->getByPlanId($planId),
        ], 200);
    }

    public function syncCoreValues(Request $request, int $planId): JsonResponse
    {
        $data = $request->validate([
            'core_value_ids'   => ['array'],
            'core_value_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('tblstrategic_foundations', 'foundation_id')->where(
                    fn ($query) => $query->where('type', 'CORE_VALUE')->where('status', '!=', 'deleted')
                ),
            ],
            'created_by' => ['required', 'integer', Rule::exists('tblusers', 'user_id')],
            'updated_by' => ['required', 'integer', Rule::exists('tblusers', 'user_id')],
        ]);

        $links = $this->linkService->syncCoreValues(
            $planId,
            $data['core_value_ids'] ?? [],
            $data['created_by'],
            $data['updated_by']
        );

        return response()->json(['message' => 'Updated', 'data' => $links], 200);
    }
}
