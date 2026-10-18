<?php

namespace App\Http\Controllers;

use App\Http\Requests\SearchLogsRequest;
use App\Http\Resources\LogResource;
use App\Services\LogService;
use App\Services\PermissionAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class LogController extends Controller
{
    public function __construct(
        private readonly LogService $logService,
        private readonly PermissionAuthorizationService $authorizationService
    ) {
    }

    public function index(SearchLogsRequest $request): JsonResponse
    {
        $this->authorizationService->ensureHasPermission(
            'logs.view',
            Auth::guard('api')->user(),
            'You are not authorized to view audit logs.'
        );

        $logs = $this->logService->search(
            $request->validated()
        );

        return response()->json([
            'message' => 'Audit logs retrieved successfully.',
            'data' => LogResource::collection(
                collect($logs->items())
            )->resolve($request),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'from' => $logs->firstItem(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'to' => $logs->lastItem(),
                'total' => $logs->total(),
            ],
            'links' => [
                'first' => $logs->url(1),
                'last' => $logs->url($logs->lastPage()),
                'prev' => $logs->previousPageUrl(),
                'next' => $logs->nextPageUrl(),
            ],
        ]);
    }

    public function show(int $log): JsonResponse
    {
        $this->authorizationService->ensureHasPermission(
            'logs.view',
            Auth::guard('api')->user(),
            'You are not authorized to view audit logs.'
        );

        $record = $this->logService->getById($log);

        if (! $record) {
            return response()->json([
                'message' => 'Audit log not found.',
            ], 404);
        }

        return response()->json([
            'data' => new LogResource($record),
        ]);
    }
}