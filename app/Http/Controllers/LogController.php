<?php

namespace App\Http\Controllers;

use App\Models\Log;
use App\Services\LogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LogController extends Controller
{
    protected $logService;

    public function __construct(LogService $logService)
    {
        $this->logService = $logService;
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'user_id' => ['nullable', 'integer', Rule::exists('tblusers', 'user_id')],
            'states' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json([
            'data' => $this->logService->getAll($filters),
        ], 200);
    }

    public function show(int $id): JsonResponse
    {
        $log = $this->logService->getById($id);

        if (!$log) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['data' => $log], 200);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $log = $this->logService->create($data);

        return response()->json(['message' => 'Created', 'data' => $log], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $log = Log::find($id);

        if (!$log) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $data = $request->validate($this->rules($log));
        $updated = $this->logService->update($id, $data);

        return response()->json(['message' => 'Updated', 'data' => $updated], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $deleted = $this->logService->delete($id);

        if (!$deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['message' => 'Deleted'], 200);
    }

    protected function rules(?Log $log = null): array
    {
        return [
            'user_id' => [
                $log ? 'sometimes' : 'required',
                'integer',
                Rule::exists('tblusers', 'user_id'),
            ],
            'operation' => [$log ? 'sometimes' : 'required', 'string'],
            'states' => ['nullable', 'string', 'max:255'],
        ];
    }
}
