<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

abstract class BaseCrudController extends Controller
{
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

    public function destroy(int $id): JsonResponse
    {
        $deleted = $this->getService()->delete($id);
        if (!$deleted) {
            return response()->json(['message' => 'Not found'], 404);
        }
        return response()->json(['message' => 'Deleted'], 200);
    }
}