<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStrategicRequest;
use App\Http\Requests\UpdateStrategicRequest;
use App\Services\StrategicService;
use Illuminate\Http\JsonResponse;

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

    public function store(StoreStrategicRequest $request): JsonResponse
    {
        $strategic = $this->strategicService->create($request->validated());

        return response()->json(['message' => 'Created', 'data' => $strategic], 201);
    }

    public function update(UpdateStrategicRequest $request, int $id): JsonResponse
    {
        $updated = $this->strategicService->update($id, $request->validated());

        if (!$updated) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }

        return response()->json(['message' => 'Updated'], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $deleted = $this->strategicService->delete($id);

        if (!$deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['message' => 'Deleted'], 200);
    }
}