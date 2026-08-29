<?php

namespace App\Http\Controllers;

use App\Http\Requests\IndexBackupsRequest;
use App\Http\Requests\StoreBackupRequest;
use App\Http\Resources\BackupResource;
use App\Models\Backup;
use App\Services\BackupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BackupController extends Controller
{
    public function __construct(private BackupService $backupService)
    {
    }

    public function index(IndexBackupsRequest $request): JsonResponse
    {
        $backups = $this->backupService->paginate(
            (int) ($request->validated('per_page') ?? 15)
        );

        return response()->json([
            'success' => true,
            'data' => BackupResource::collection(
                collect($backups->items())
            )->resolve($request),
            'meta' => [
                'current_page' => $backups->currentPage(),
                'from' => $backups->firstItem(),
                'last_page' => $backups->lastPage(),
                'per_page' => $backups->perPage(),
                'to' => $backups->lastItem(),
                'total' => $backups->total(),
            ],
        ], 200);
    }

    /**
     * Run a backup now.
     *
     * Synchronous: the administrator asked for it and is waiting for the
     * result. On a large database this can take a while, which the UI warns
     * about before the request is sent.
     */
    public function store(StoreBackupRequest $request): JsonResponse
    {
        try {
            $backup = $this->backupService->create(Auth::guard('api')->user());
        } catch (RuntimeException $exception) {
            // The service has already recorded a failed row and audited it.
            return response()->json([
                'success' => false,
                'message' => $exception->getMessage(),
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => 'Backup created successfully.',
            'data' => new BackupResource($backup),
        ], 201);
    }

    /**
     * Stream a completed backup to the administrator.
     *
     * Every download is written to the audit log before the file is sent,
     * since this is the point at which a full copy of the database leaves
     * the server.
     */
    public function download(Backup $backup): BinaryFileResponse|JsonResponse
    {
        $path = $this->backupService->pathFor($backup);

        if ($path === null) {
            return response()->json([
                'success' => false,
                'message' => 'This backup file is no longer available.',
            ], 404);
        }

        $this->backupService->recordDownload(Auth::guard('api')->user(), $backup);

        return response()->download($path, $backup->filename);
    }
}
