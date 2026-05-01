<?php

namespace App\Http\Controllers;

use App\Models\StrategicFoundations;
use App\Services\FoundationsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FoundationsController extends Controller
{
    protected $foundationsService;

    public function __construct(FoundationsService $foundationsService)
    {
        $this->foundationsService = $foundationsService;
    }

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['nullable', 'string', Rule::in($this->types())],
        ]);

        return response()->json([
            'data' => $this->foundationsService->getAll($data['type'] ?? null),
        ], 200);
    }

    public function show(int $id): JsonResponse
    {
        $foundation = $this->foundationsService->getById($id);

        if (!$foundation) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['data' => $foundation], 200);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $foundation = $this->foundationsService->create($data);

        return response()->json(['message' => 'Created', 'data' => $foundation], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $foundation = StrategicFoundations::find($id);

        if (!$foundation) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $data = $request->validate($this->rules($foundation));
        $updated = $this->foundationsService->update($id, $data);

        return response()->json(['message' => 'Updated', 'data' => $updated], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $deleted = $this->foundationsService->delete($id);

        if (!$deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['message' => 'Deleted'], 200);
    }

    protected function rules(?StrategicFoundations $foundation = null): array
    {
        return [
            'created_by' => [
                $foundation ? 'sometimes' : 'required',
                'integer',
                Rule::exists('tblusers', 'user_id'),
            ],
            'updated_by' => [
                'nullable',
                'integer',
                Rule::exists('tblusers', 'user_id'),
            ],
            'type' => [
                $foundation ? 'sometimes' : 'required',
                'string',
                Rule::in($this->types()),
            ],
            'content' => [$foundation ? 'sometimes' : 'required', 'string'],
            'version' => [$foundation ? 'sometimes' : 'required', 'string', 'max:255'],
        ];
    }

    protected function types(): array
    {
        return [
            'MISSION',
            'VISION',
            'CORE_VALUE',
        ];
    }
}
