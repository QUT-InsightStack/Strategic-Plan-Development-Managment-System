<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStrategicDocumentRequest;
use App\Http\Resources\StrategicDocumentResource;
use App\Models\Strategic;
use App\Models\StrategicDocument;
use App\Models\StrategicObjective;
use App\Services\StrategicDocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class StrategicDocumentController extends Controller
{
    public function __construct(private readonly StrategicDocumentService $service) {}

    public function planIndex(Strategic $plan, Request $request): JsonResponse
    {
        return $this->index('strategic_plan_id', $plan->record_id);
    }

    public function objectiveIndex(StrategicObjective $objective, Request $request): JsonResponse
    {
        return $this->index('objective_id', $objective->objective_id);
    }

    public function storeForPlan(Strategic $plan, StoreStrategicDocumentRequest $request): JsonResponse
    {
        return $this->store('strategic_plan_id', $plan->record_id, $request);
    }

    public function storeForObjective(StrategicObjective $objective, StoreStrategicDocumentRequest $request): JsonResponse
    {
        return $this->store('objective_id', $objective->objective_id, $request);
    }

    public function download(StrategicDocument $document): BinaryFileResponse|JsonResponse
    {
        $path = $this->service->pathFor($document);
        if ($path === null) {
            return response()->json(['success' => false, 'message' => 'This document is no longer available.'], 404);
        }

        return response()->download($path, $document->original_filename, ['Content-Type' => $document->mime_type]);
    }

    private function index(string $column, int $id): JsonResponse
    {
        $documents = $this->service->listFor($column, $id);
        return response()->json([
            'success' => true,
            'data' => StrategicDocumentResource::collection($documents->items())->resolve(),
            'meta' => ['current_page' => $documents->currentPage(), 'last_page' => $documents->lastPage(), 'per_page' => $documents->perPage(), 'total' => $documents->total()],
        ]);
    }

    private function store(string $column, int $id, StoreStrategicDocumentRequest $request): JsonResponse
    {
        $document = $this->service->store($request->file('document'), Auth::guard('api')->user(), $column, $id);
        return response()->json(['success' => true, 'message' => 'Document uploaded successfully.', 'data' => new StrategicDocumentResource($document)], 201);
    }
}