<?php

namespace App\Services;

use App\Models\StrategicDocument;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class StrategicDocumentService
{
    private const DISK = 'local';
    private const DIRECTORY = 'strategic-documents';

    public function listFor(string $column, int $id, int $perPage = 25): LengthAwarePaginator
    {
        return StrategicDocument::query()->where($column, $id)->latest()->paginate($perPage);
    }

    public function store(UploadedFile $file, User $user, string $column, int $id): StrategicDocument
    {
        $extension = strtolower($file->extension());
        $storedPath = self::DIRECTORY.'/'.Str::uuid().'.'.$extension;

        if (! $file->storeAs(self::DIRECTORY, basename($storedPath), self::DISK)) {
            throw new RuntimeException('The document could not be stored.');
        }

        try {
            return StrategicDocument::create([
                'strategic_plan_id' => $column === 'strategic_plan_id' ? $id : null,
                'objective_id' => $column === 'objective_id' ? $id : null,
                'uploaded_by' => $user->user_id,
                'original_filename' => $this->safeOriginalFilename($file->getClientOriginalName()),
                'stored_path' => $storedPath,
                'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                'extension' => $extension,
                'size_bytes' => (int) $file->getSize(),
                'sha256' => hash_file('sha256', $file->getRealPath()),
            ]);
        } catch (\Throwable $exception) {
            Storage::disk(self::DISK)->delete($storedPath);
            throw $exception;
        }
    }

    public function pathFor(StrategicDocument $document): ?string
    {
        $path = Storage::disk(self::DISK)->path($document->stored_path);

        return is_file($path) ? $path : null;
    }

    private function safeOriginalFilename(string $filename): string
    {
        $filename = basename(str_replace('\\', '/', $filename));
        $filename = preg_replace('/[\x00-\x1F\x7F]/', '', $filename) ?: 'document';

        return $filename !== '' ? $filename : 'document';
    }
}