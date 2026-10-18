<?php

namespace App\Http\Controllers;

use App\Http\Requests\SearchLoginHistoryRequest;
use App\Http\Resources\LoginHistoryResource;
use App\Models\LoginHistory;
use App\Services\LoginHistoryService;
use App\Services\PermissionAuthorizationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LoginHistoryController extends Controller
{
    public function __construct(
        private readonly LoginHistoryService $loginHistoryService,
        private readonly PermissionAuthorizationService $authorizationService
    ) {
    }

    public function index(
        SearchLoginHistoryRequest $request
    ): JsonResponse {
        $this->authorizationService->ensureHasPermission(
            'login_history.view',
            Auth::guard('api')->user(),
            'You are not authorized to view login history.'
        );

        $history = $this->loginHistoryService->search(
            $request->validated()
        );

        return response()->json([
            'message' => 'Login history retrieved successfully.',
            'data' => LoginHistoryResource::collection(
                collect($history->items())
            )->resolve($request),
            'meta' => [
                'current_page' => $history->currentPage(),
                'from' => $history->firstItem(),
                'last_page' => $history->lastPage(),
                'per_page' => $history->perPage(),
                'to' => $history->lastItem(),
                'total' => $history->total(),
            ],
            'links' => [
                'first' => $history->url(1),
                'last' => $history->url(
                    $history->lastPage()
                ),
                'prev' => $history->previousPageUrl(),
                'next' => $history->nextPageUrl(),
            ],
        ], 200);
    }

    public function me(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:25'],
        ]);
        $userId = (int) Auth::guard('api')->id();
        $history = $this->loginHistoryService->search([
            'user_id' => $userId,
            'per_page' => (int) ($validated['limit'] ?? 10),
        ]);

        return response()->json([
            'message' => 'Your login history was retrieved successfully.',
            'data' => LoginHistoryResource::collection(collect($history->items()))->resolve($request),
            'meta' => [
                'recent_failures' => LoginHistory::query()
                    ->where('user_id', $userId)
                    ->where('status', 'failed')
                    ->where('attempted_at', '>=', now()->subDays(30))
                    ->count(),
            ],
        ]);
    }

    public function show(int $loginHistory): JsonResponse
    {
        $this->authorizationService->ensureHasPermission(
            'login_history.view',
            Auth::guard('api')->user(),
            'You are not authorized to view login history.'
        );

        $record = $this->loginHistoryService->getById(
            $loginHistory
        );

        if (! $record) {
            return response()->json([
                'message' => 'Login-history record not found.',
            ], 404);
        }

        return response()->json([
            'data' => new LoginHistoryResource($record),
        ], 200);
    }
}
