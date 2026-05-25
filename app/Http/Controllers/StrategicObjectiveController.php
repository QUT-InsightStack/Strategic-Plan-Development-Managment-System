<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStrategicObjectiveRequest;
use App\Http\Requests\UpdateStrategicObjectiveRequest;
use App\Models\StrategicObjective;
use Illuminate\Http\JsonResponse;

class StrategicObjectiveController extends Controller
{
    public function index(): JsonResponse
    {
        $objectives = StrategicObjective::with(['strategicPlan', 'creator', 'updater'])
            ->latest()
            ->get();

        return response()->json(['data' => $objectives], 200);
    }

    public function byPlan(int $planId): JsonResponse
    {
        $objectives = StrategicObjective::where('strategic_plan_id', $planId)
            ->latest()
            ->get();

        return response()->json(['data' => $objectives], 200);
    }

    public function show(int $id): JsonResponse
    {
        $objective = StrategicObjective::with(['strategicPlan', 'creator', 'updater'])
            ->find($id);

        if (! $objective) {
            return response()->json(['message' => 'Not found'], 404);
        }

        return response()->json(['data' => $objective], 200);
    }

    public function store(StoreStrategicObjectiveRequest $request): JsonResponse
    {
        $objective = StrategicObjective::create($request->validated());

        return response()->json([
            'message' => 'Created',
            'data' => $objective,
        ], 201);
    }

    public function update(UpdateStrategicObjectiveRequest $request, int $id): JsonResponse
    {
        $objective = StrategicObjective::find($id);

        if (! $objective) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $objective->update($request->validated());

        return response()->json([
            'message' => 'Updated',
            'data' => $objective->fresh(),
        ], 200);
    }

    public function destroy(int $id): JsonResponse
    {
        $objective = StrategicObjective::find($id);

        if (! $objective) {
            return response()->json(['message' => 'Not found'], 404);
        }

        $objective->delete();

        return response()->json(['message' => 'Deleted'], 200);
    }
}