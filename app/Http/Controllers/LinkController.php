<?php

namespace App\Http\Controllers;

use App\Models\Link;
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
            'plan_id' => ['nullable', 'integer', Rule::exists('tblstrategic_record', 'record_id')],
            'core_value_id' => ['nullable', 'integer', $this->coreValueExistsRule()],
        ]);

        return response()->json([
            'data' => $this->linkService->getAll($filters),
        ], 200);
    }

    public function show(int $id): JsonResponse
    {
        $link = $this->linkService->getById($id);

        if (!$link) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['data' => $link], 200);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $link = $this->linkService->create($data);

        return response()->json(['message' => 'Created', 'data' => $link], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $link = Link::find($id);

        if (!$link) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $data = $request->validate($this->rules($link));
        $updated = $this->linkService->update($id, $data);

        return response()->json(['message' => 'Updated', 'data' => $updated], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $deleted = $this->linkService->delete($id);

        if (!$deleted) {
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
            'core_value_ids' => ['array'],
            'core_value_ids.*' => [
                'integer',
                'distinct',
                $this->coreValueExistsRule(),
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

    protected function rules(?Link $link = null): array
    {
        $planId = request('plan_id', $link?->plan_id);

        return [
            'core_value_id' => [
                $link ? 'sometimes' : 'required',
                'integer',
                $this->coreValueExistsRule(),
                Rule::unique('tblplan_core_value')
                    ->where('plan_id', $planId)
                    ->ignore($link?->link_id, 'link_id'),
            ],
            'plan_id' => [
                $link ? 'sometimes' : 'required',
                'integer',
                Rule::exists('tblstrategic_record', 'record_id'),
            ],
            'created_by' => [
                $link ? 'sometimes' : 'required',
                'integer',
                Rule::exists('tblusers', 'user_id'),
            ],
            'updated_by' => [
                $link ? 'sometimes' : 'required',
                'integer',
                Rule::exists('tblusers', 'user_id'),
            ],
        ];
    }

    protected function coreValueExistsRule()
    {
        return Rule::exists('tblstrategic_foundations', 'foundation_id')
            ->where('type', 'CORE_VALUE');
    }
}
