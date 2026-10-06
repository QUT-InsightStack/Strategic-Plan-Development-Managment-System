<?php

namespace App\Http\Controllers;

use App\Http\Requests\UpdateSecuritySettingsRequest;
use App\Services\SystemSettingsService;
use Illuminate\Http\JsonResponse;

class SecuritySettingsController extends Controller
{
    public function __construct(private readonly SystemSettingsService $settings) {}

    public function show(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $this->legacyValues($this->settings->show())]);
    }

    public function update(UpdateSecuritySettingsRequest $request): JsonResponse
    {
        $result = $this->settings->update($request->validated());
        return response()->json([
            'success' => true,
            'message' => 'Security settings updated successfully.',
            'data' => $this->legacyValues($result['settings']),
        ]);
    }

    private function legacyValues(\App\Models\SystemSetting $settings): array
    {
        return [
            'session_timeout_minutes' => $settings->session_idle_timeout_minutes,
            'max_failed_login_attempts' => $settings->login_attempt_limit,
            'lockout_duration_minutes' => $settings->login_lockout_minutes,
        ];
    }
}
