<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class BaseCrudController extends Controller
{
    protected $service;

    
    abstract protected function getService();

    // Override these in child controllers to add validation
    protected function getStoreRules(): array
    {
        return [];
    }

    protected function getUpdateRules(int $id): array
    {
        return [];
    }

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
        $data = $request->validate($this->getStoreRules());
        $record = $this->getService()->create($data);
        return response()->json(['message' => 'Created', 'data' => $record], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $data = $request->validate($this->getUpdateRules($id));
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