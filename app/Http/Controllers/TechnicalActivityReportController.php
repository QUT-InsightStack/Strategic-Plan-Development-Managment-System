<?php

namespace App\Http\Controllers;

use App\Contracts\StrategicLogWriter;
use App\Services\TechnicalActivityReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Technical Administration activity report: same template contract as the Management report master.
 * The dashboard and the report read this endpoint; sections follow the user's technical permissions.
 */
class TechnicalActivityReportController extends Controller
{
    public function __construct(
        private readonly TechnicalActivityReportService $reports,
        private readonly StrategicLogWriter $logWriter,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $user = Auth::guard('api')->user();
        abort_unless($this->reports->canView($user), 403, 'You are not authorized to view technical activity.');

        return response()->json(['success' => true, 'data' => $this->reports->build($user, $this->filters($request))]);
    }

    public function export(Request $request): StreamedResponse|JsonResponse
    {
        $user = Auth::guard('api')->user();
        abort_unless($this->reports->canView($user), 403, 'You are not authorized to view technical activity.');
        $filters = $this->filters($request);
        $options = $request->validate([
            'format' => ['required', Rule::in(['csv'])],
            'section' => ['required', 'string', Rule::in(array_keys(TechnicalActivityReportService::SECTIONS))],
            'table' => ['nullable', 'string', 'max:50', 'regex:/^[a-z_]+$/'],
        ]);
        $report = $this->reports->build($user, $filters);
        abort_if($this->reports->isOmitted($report, $options['section']), 403, 'You are not authorized to export this report section.');
        $table = $this->reports->table($report, $options['section'], $options['table'] ?? null);
        abort_unless($table, 404, 'This report section has no exportable table.');
        [, $columns, $rows] = $table;

        $this->logWriter->write('technical_report.exported', [
            'resource_type' => 'technical_report',
            'section' => $options['section'],
            'table' => $options['table'] ?? null,
            'format' => $options['format'],
            'days' => $report['meta']['days'],
            'row_count' => count($rows),
        ]);

        $name = 'technical-report-'.$options['section'].(isset($options['table']) ? '-'.$options['table'] : '').'-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($columns, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fwrite($out, ManagementReportController::csvLine(array_column($columns, 'label')));
            foreach ($rows as $row) {
                fwrite($out, ManagementReportController::csvLine(array_map(fn ($column) => $row[$column['key']] ?? '', $columns)));
            }
            fclose($out);
        }, $name, ['Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'no-store']);
    }

    private function filters(Request $request): array
    {
        return $request->validate([
            'days' => ['nullable', 'integer', Rule::in(TechnicalActivityReportService::PERIODS)],
        ]);
    }
}
