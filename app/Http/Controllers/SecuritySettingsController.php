<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateSecuritySettingsRequest;
use App\Services\SecuritySettingsService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Http\JsonResponse;

class SecuritySettingsController extends Controller
{
    public function __construct(private readonly SecuritySettingsService $settings) {}

    public function show(): JsonResponse
    {
        abort_unless($this->settings->technicalAdmin(Auth::guard('api')->user()), 403);
        return response()->json(['success' => true, 'data' => $this->settings->all()]);
    }

    public function update(UpdateSecuritySettingsRequest $request): JsonResponse
    {
        abort_unless($this->settings->technicalAdmin(Auth::guard('api')->user()), 403);
        return response()->json([
            'success' => true,
            'message' => 'Security settings updated successfully.',
            'data' => $this->settings->update($request->validated()),
        ]);
    }
}