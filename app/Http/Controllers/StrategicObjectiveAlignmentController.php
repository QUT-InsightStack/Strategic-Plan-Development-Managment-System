<?php

namespace App\Http\Controllers;

use App\Http\Requests\ArchiveStrategicAlignmentRequest;
use App\Services\StrategicAlignmentArchiveService;
use Illuminate\Http\JsonResponse;

class StrategicObjectiveAlignmentController extends Controller
{
    public function __construct(
        private readonly StrategicAlignmentArchiveService $archives
    ) {}

    public function archive(
        ArchiveStrategicAlignmentRequest $request,
        int $id,
        string $type,
        int $referenceId
    ): JsonResponse {
        $mapping = $this->archives->archive(
            $id,
            $type,
            $referenceId,
            $request->user('api')
        );

        return response()->json([
            'success' => true,
            'message' => 'Strategic alignment mapping archived successfully.',
            'data' => $mapping,
        ]);
    }
}