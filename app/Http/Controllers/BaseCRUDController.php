<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class BaseCrudController extends Controller
{
    protected $service;

    // Subclasses must implement this method and return the corresponding Service
    abstract protected function getService();

    public function index(): JsonResponse
    {
        $data = $this->getService()->getAll();
        return response()->json(['data' => $data], 200);
    }

    public function show(int $id): JsonResponse
    {
        $record = $this->getService()->getById($id);
        if (!$record) {
            return response()->json(['message' => 'Not found'], 404);
        }
        return response()->json(['data' => $record], 200);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validated();
        $record = $this->getService()->create($data);
        return response()->json(['message' => 'Created', 'data' => $record], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $data = $request->validated();
        $updated = $this->getService()->update($id, $data);
        if (!$updated) {
            return response()->json(['message' => 'Not found or update failed'], 404);
        }
        return response()->json(['message' => 'Updated'], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $deleted = $this->getService()->delete($id);
        if (!$deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }
        return response()->json(['message' => 'Deleted'], 200);
    }
}