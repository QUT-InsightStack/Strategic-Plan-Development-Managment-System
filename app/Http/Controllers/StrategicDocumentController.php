<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreStrategicDocumentRequest;
use App\Http\Resources\StrategicDocumentResource;
use App\Models\Strategic;
use App\Models\StrategicDocument;
use App\Models\StrategicObjective;
use App\Services\StrategicDocumentService;
use App\Services\StrategicPlanAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class StrategicDocumentController extends Controller
{
    public function __construct(
        private readonly StrategicDocumentService $service,
        private readonly StrategicPlanAuthorizationService $planAuthorization,
    ) {}

    public function listing(Request $request): JsonResponse
{
    $user = $request->user('api');
    $this->planAuthorization->ensureCanViewAny($user);

    $validated = $request->validate([
        'plan_id' => ['nullable', 'integer', 'min:1'],
        'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
    ]);

    $planIds = $this->planAuthorization
        ->authorizedPlanIdsForListing($user);

    if (isset($validated['plan_id'])) {
        $planId = (int) $validated['plan_id'];

        abort_unless(
            $planIds->contains($planId),
            403,
            'This plan is outside your authorised scope.',
        );

        $planIds = collect([$planId]);
    }

    $documents = $this->service->listForPlans(
        $planIds->all(),
        $validated['per_page'] ?? 25,
    );

    return response()->json([
        'success' => true,
        'data' => StrategicDocumentResource::collection(
            $documents->items()
        )->resolve(),
        'meta' => [
            'current_page' => $documents->currentPage(),
            'last_page' => $documents->lastPage(),
            'per_page' => $documents->perPage(),
            'total' => $documents->total(),
        ],
    ]);
}
    public function planIndex(Strategic $plan, Request $request): JsonResponse
{
    $this->authorizePlan($plan);

    return $this->index('strategic_plan_id', $plan->record_id);
}

public function objectiveIndex(StrategicObjective $objective, Request $request): JsonResponse
{
    $this->authorizeObjective($objective);

    return $this->index('objective_id', $objective->objective_id);
}

    public function storeForPlan(Strategic $plan, StoreStrategicDocumentRequest $request): JsonResponse
{
    $this->authorizePlan($plan);

    return $this->store('strategic_plan_id', $plan->record_id, $request);
}

public function storeForObjective(StrategicObjective $objective, StoreStrategicDocumentRequest $request): JsonResponse
{
    $this->authorizeObjective($objective);

    return $this->store('objective_id', $objective->objective_id, $request);
}

  public function download(StrategicDocument $document): BinaryFileResponse|JsonResponse
{
    if ($document->objective_id !== null) {
        $objective = $document->objective()->firstOrFail();
        $this->authorizeObjective($objective);
    } else {
        $plan = $document->plan()->firstOrFail();
        $this->authorizePlan($plan);
    }

    $path = $this->service->pathFor($document);

    if ($path === null) {
        return response()->json([
            'success' => false,
            'message' => 'This document is no longer available.',
        ], 404);
    }

    return response()->download(
        $path,
        $document->original_filename,
        [
            'Content-Type' => $document->mime_type,
            'X-Content-Type-Options' => 'nosniff',
        ],
    );
}
private function authorizePlan(Strategic $plan): void
{
    abort_if($plan->status === 'deleted', 404);

    $this->planAuthorization->ensureCanViewPlan(
        $plan,
        Auth::guard('api')->user(),
    );
}

private function authorizeObjective(StrategicObjective $objective): void
{
    abort_if($objective->status === 'deleted', 404);

    $plan = Strategic::findOrFail($objective->strategic_plan_id);
    $this->authorizePlan($plan);

    $query = StrategicObjective::query()->whereKey(
        $objective->objective_id,
    );

    $this->planAuthorization->scopeObjectivesForUser(
        $query,
        Auth::guard('api')->user(),
    );

    abort_unless(
        $query->exists(),
        403,
        'This objective is outside your authorised scope.',
    );
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
        $document = $this->service->store(
            $request->file('document'),
            Auth::guard('api')->user(),
            $column,
            $id,
            $request->validated('reference_level'),
            $request->validated('content_category'),
        );
        return response()->json(['success' => true, 'message' => 'Document uploaded successfully.', 'data' => new StrategicDocumentResource($document)], 201);
    }
}
