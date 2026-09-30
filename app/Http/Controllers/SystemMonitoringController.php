<?php

namespace App\Http\Controllers;

use App\Http\Requests\SystemMonitoringRequest;
use App\Models\SystemAlert;
use App\Models\SystemCheck;
use App\Models\SystemEvent;
use App\Models\SystemRequest;
use App\Services\SystemHealthService;
use App\Services\SystemMonitoringService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SystemMonitoringController extends Controller
{
    private function window(SystemMonitoringRequest $request): array
    {
        $to = $request->filled('to') ? CarbonImmutable::parse($request->validated('to')) : now()->toImmutable();
        $from = $request->filled('from') ? CarbonImmutable::parse($request->validated('from'))
            : $to->subMinutes((int) $request->validated('minutes', config('monitoring.window_minutes')));
        if ($from->gt($to)) {
            throw ValidationException::withMessages(['from' => 'The start must not follow the end.']);
        }

        return [$from->utc(), $to->utc()];
    }

    public function events(SystemMonitoringRequest $request): JsonResponse
    {
        $query = SystemEvent::whereBetween('occurred_at', $this->window($request));
        foreach (['severity', 'source', 'event', 'outcome', 'request_id'] as $field) {
            if ($request->filled($field)) {
                $query->where($field, $request->validated($field));
            }
        }
        if ($request->filled('status_code')) {
            $query->where('context->status_code', (int) $request->validated('status_code'));
        }

        return response()->json($query->orderByDesc('occurred_at')->orderByDesc('id')
            ->paginate((int) $request->validated('per_page', 25))->withQueryString());
    }

    public function event(SystemMonitoringRequest $request, int $id): JsonResponse
    {
        return response()->json(['data' => SystemEvent::findOrFail($id)]);
    }

    public function alerts(SystemMonitoringRequest $request): JsonResponse
    {
        $query = SystemAlert::query();
        foreach (['status', 'severity'] as $field) {
            if ($request->filled($field)) {
                $query->where($field, $request->validated($field));
            }
        }

        return response()->json($query->orderByDesc('opened_at')->orderByDesc('id')
            ->paginate((int) $request->validated('per_page', 25))->withQueryString());
    }

    public function trends(SystemMonitoringRequest $request): JsonResponse
    {
        return response()->json(DB::table('tblsystem_metrics')
            ->whereBetween('bucket_at', $this->window($request))->orderByDesc('bucket_at')
            ->paginate((int) $request->validated('per_page', 25))->withQueryString());
    }

    public function summary(SystemMonitoringRequest $request, SystemMonitoringService $monitoring): JsonResponse
    {
        $latest = SystemCheck::orderByDesc('id')->first();

        return response()->json([
            'data' => $monitoring->summary((int) $request->validated('minutes', config('monitoring.window_minutes')), ...$this->window($request)),
            'latest_check' => $latest,
            'scheduler_stale' => ! $latest || $latest->checked_at->lt(now()->subMinutes(3)),
            'collection_enabled' => (bool) config('monitoring.enabled'),
        ]);
    }

    public function requests(SystemMonitoringRequest $request): JsonResponse
    {
        $filters = $request->validated();
        $query = SystemRequest::whereBetween('occurred_at', $this->window($request));
        foreach (['status_code', 'request_id'] as $field) {
            if (isset($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }
        if ($filters['slow'] ?? false) {
            $query->where('duration_ms', '>=', config('monitoring.slow_request_ms'));
        }

        return response()->json($query->orderByDesc('occurred_at')->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 25))->withQueryString());
    }

    public function health(SystemMonitoringRequest $request, SystemHealthService $health): JsonResponse
    {
        $result = $health->check();

        return response()->json(['data' => $result], $result['status'] === 'unhealthy' ? 503 : 200);
    }

    public function checks(SystemMonitoringRequest $request): JsonResponse
    {
        return response()->json(SystemCheck::whereBetween('checked_at', $this->window($request))->orderByDesc('checked_at')->orderByDesc('id')
            ->paginate((int) $request->validated('per_page', 25))->withQueryString());
    }
}
