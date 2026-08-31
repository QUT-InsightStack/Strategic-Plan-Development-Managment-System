<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BackupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'backup_id' => $this->backup_id,
            'filename' => $this->filename,
            'size_bytes' => $this->size_bytes,
            'size_label' => $this->sizeLabel(),
            'driver' => $this->driver,
            'status' => $this->status,
            'error_message' => $this->error_message,
            'downloadable' => $this->isDownloadable(),

            'created_by' => $this->whenLoaded('creator', function (): ?array {
                if (! $this->creator) {
                    return null;
                }

                return [
                    'user_id' => $this->creator->user_id,
                    'name' => $this->creator->name,
                ];
            }),

            'created_at' => $this->created_at,
        ];
    }

    private function sizeLabel(): ?string
    {
        $bytes = $this->size_bytes;

        if ($bytes === null) {
            return null;
        }

        if ($bytes < 1024) {
            return $bytes . ' B';
        }

        $units = ['KB', 'MB', 'GB', 'TB'];
        $value = $bytes / 1024;
        $unit = 0;

        while ($value >= 1024 && $unit < count($units) - 1) {
            $value /= 1024;
            $unit++;
        }

        return round($value, $value >= 10 ? 0 : 1) . ' ' . $units[$unit];
    }
}
