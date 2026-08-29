<?php

namespace App\Http\Controllers;

use App\Http\Requests\IndexLoginHistoryRequest;
use App\Http\Resources\LoginHistoryResource;
use App\Services\LoginHistoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LoginHistoryController extends Controller
{
    public function __construct(private LoginHistoryService $loginHistory)
    {
    }

    /**
     * The signed-in user's own sign-in history.
     *
     * No permission beyond being authenticated: everyone is entitled to see
     * where their own account has been used from. The user is taken from the
     * token, never from a parameter, so this cannot be pointed at anyone
     * else's account.
     */
    public function mine(Request $request): JsonResponse
    {
        $user = Auth::guard('api')->user();

        $limit = min(max((int) $request->integer('limit', 10), 1), 50);

        return response()->json([
            'success' => true,
            'data' => LoginHistoryResource::collection(
                $this->loginHistory->forUser($user, $limit)
            )->resolve($request),
            'meta' => [
                'recent_failures' => $this->loginHistory->recentFailureCount($user),
            ],
        ], 200);
    }

    /**
     * Sign-in history across every account, for administrators.
     */
    public function index(IndexLoginHistoryRequest $request): JsonResponse
    {
        $history = $this->loginHistory->paginate($request->validated());

        return response()->json([
            'success' => true,
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
        ], 200);
    }
}
