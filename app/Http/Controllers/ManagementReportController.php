<?php

namespace App\Http\Controllers;

use App\Contracts\StrategicLogWriter;
use App\Services\ManagementReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Management report master: one fixed template whose sections and rows are decided here,
 * from the user's permissions and existing data-scope rules. The frontend only renders and exports.
 */
class ManagementReportController extends Controller
{
    public function __construct(
        private readonly ManagementReportService $reports,
        private readonly StrategicLogWriter $logWriter,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $report = $this->reports->build(Auth::guard('api')->user(), $this->filters($request));

        return response()->json(['success' => true, 'data' => $report]);
    }

    public function export(Request $request): StreamedResponse|JsonResponse
    {
        $user = Auth::guard('api')->user();
        $filters = $this->filters($request);
        $options = $request->validate([
            'format' => ['required', Rule::in(['csv'])],
            'section' => ['required', 'string', Rule::in(array_keys(ManagementReportService::SECTIONS))],
            'table' => ['nullable', 'string', 'max:50', 'regex:/^[a-z_]+$/'],
        ]);
        $report = $this->reports->build($user, $filters);
        abort_if($this->reports->isOmitted($report, $options['section']), 403, 'You are not authorized to export this report section.');
        $table = $this->reports->table($report, $options['section'], $options['table'] ?? null);
        abort_unless($table, 404, 'This report section has no exportable table.');
        [, $columns, $rows] = $table;

        $this->logWriter->write('management_report.exported', [
            'resource_type' => 'management_report',
            'section' => $options['section'],
            'table' => $options['table'] ?? null,
            'format' => $options['format'],
            'filters' => array_filter($filters, fn ($value) => $value !== null && $value !== ''),
            'row_count' => count($rows),
        ]);

        $name = 'management-report-'.$options['section'].(isset($options['table']) ? '-'.$options['table'] : '').'-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($columns, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fwrite($out, self::csvLine(array_column($columns, 'label')));
            foreach ($rows as $row) {
                fwrite($out, self::csvLine(array_map(fn ($column) => $row[$column['key']] ?? '', $columns)));
            }
            fclose($out);
        }, $name, ['Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'no-store']);
    }

    /** Quotes every cell and neutralises spreadsheet formulas, like the dashboard's CSV export. */
    public static function csvLine(array $values): string
    {
        return implode(',', array_map(function ($value) {
            $raw = (string) ($value ?? '');
            $safe = preg_match('/^\s*[=+\-@]/', $raw) ? "'".$raw : $raw;

            return '"'.str_replace('"', '""', $safe).'"';
        }, $values))."\r\n";
    }

    private function filters(Request $request): array
    {
        return $request->validate([
            'plan_id' => ['nullable', 'integer', 'min:1'],
            'period' => ['nullable', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'office' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'regex:/^(plan|objective):[a-z_]+$/'],
            'approval_status' => ['nullable', Rule::in(array_keys(ManagementReportService::APPROVAL_LABELS))],
        ]);
    }
}
