<?php

namespace App\Http\Controllers;

use App\Models\Strategic;
use App\Services\StrategicService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StrategicController extends Controller
{
    protected $strategicService;

    public function __construct(StrategicService $strategicService)
    {
        $this->strategicService = $strategicService;
    }

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->strategicService->getAll()], 200);
    }

    public function show(int $id): JsonResponse
    {
        $strategic = $this->strategicService->getById($id);

        if (!$strategic) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['data' => $strategic], 200);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $strategic = $this->strategicService->create($data);

        return response()->json(['message' => 'Created', 'data' => $strategic], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $strategic = Strategic::find($id);

        if (!$strategic) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $data = $request->validate($this->rules($strategic));
        $updated = $this->strategicService->update($id, $data);

        return response()->json(['message' => 'Updated', 'data' => $updated], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $deleted = $this->strategicService->delete($id);

        if (!$deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['message' => 'Deleted'], 200);
    }

    protected function rules(?Strategic $strategic = null): array
    {
        return [
            'created_by' => [
                $strategic ? 'sometimes' : 'required',
                'integer',
                Rule::exists('tblusers', 'user_id'),
            ],
            'updated_by' => [
                'nullable',
                'integer',
                Rule::exists('tblusers', 'user_id'),
            ],
            'level' => [$strategic ? 'sometimes' : 'required', 'string', 'max:255'],
            'content' => [$strategic ? 'sometimes' : 'required', 'string'],
            'mission' => [
                $strategic ? 'sometimes' : 'required',
                'integer',
                Rule::exists('tblstrategic_foundations', 'foundation_id'),
            ],
            'vision' => [
                $strategic ? 'sometimes' : 'required',
                'integer',
                Rule::exists('tblstrategic_foundations', 'foundation_id'),
            ],
            'parent_ids' => ['array'],
            'parent_ids.*' => [
                'integer',
                'distinct',
                Rule::exists('tblstrategic_record', 'record_id'),
                Rule::notIn([$strategic?->record_id]),
            ],
        ];
    }
}
