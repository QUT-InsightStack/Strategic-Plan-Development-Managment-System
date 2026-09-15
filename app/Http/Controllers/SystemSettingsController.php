<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateSystemSettingsRequest;
use App\Http\Resources\SystemSettingsResource;
use App\Services\SystemSettingsService;
use Illuminate\Http\JsonResponse;

class SystemSettingsController extends Controller
{
    public function __construct(
        private readonly SystemSettingsService $settings
    ) {
    }

    public function show(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'System settings retrieved successfully.',
            'data' => new SystemSettingsResource($this->settings->show()),
        ]);
    }

    public function update(UpdateSystemSettingsRequest $request): JsonResponse
    {
        $result = $this->settings->update($request->validated());

        return response()->json([
            'success' => true,
            'message' => $result['changed']
                ? 'System settings updated successfully.'
                : 'No changes were made.',
            'data' => new SystemSettingsResource($result['settings']),
        ]);
    }
}