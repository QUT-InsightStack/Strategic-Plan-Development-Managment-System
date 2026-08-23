<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\Link;
use App\Models\Strategic;
use App\Models\StrategicFoundations;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class FoundationsService
{
    public function __construct(private readonly StrategicLogWriter $logWriter)
    {
    }

    public function getAll(?string $type = null): Collection
    {
        $query = StrategicFoundations::with($this->relations())
            ->where('status', '!=', 'deleted');

        if ($type) {
            $query->where('type', $type);
        }

        return $query->get();
    }

    public function getById(int $id): ?Model
    {
        return StrategicFoundations::with($this->relations())
            ->where('status', '!=', 'deleted')
            ->find($id);
    }

    public function create(array $data): Model
    {
        $foundation = StrategicFoundations::create($data + [
            'status' => 'active',
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => null,
        ]);

        $this->logWriter->write('foundation.created', [
            'foundation_id' => $foundation->foundation_id,
            'type' => $foundation->type,
        ]);

        return $foundation->load($this->relations());
    }

    public function update(int $id, array $data): ?Model
    {
        $foundation = StrategicFoundations::where('status', '!=', 'deleted')->find($id);

        if (! $foundation) {
            return null;
        }

        $foundation->update($data);

        $this->logWriter->write('foundation.updated', [
            'foundation_id' => $foundation->foundation_id,
            'type' => $foundation->type,
        ]);

        return $foundation->load($this->relations());
    }

    public function delete(int $id): bool
    {
        $foundation = StrategicFoundations::where('status', '!=', 'deleted')->find($id);

        if (! $foundation) {
            return false;
        }

        $this->assertFoundationCanBeDeleted($foundation);

        $foundation->update([
            'status' => 'deleted',
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => now(),
        ]);

        $this->logWriter->write('foundation.deleted', [
            'foundation_id' => $foundation->foundation_id,
            'type' => $foundation->type,
        ]);

        return true;
    }

    protected function relations(): array
    {
        return [
            'creator',
            'updater',
        ];
    }

    private function assertFoundationCanBeDeleted(StrategicFoundations $foundation): void
    {
        $isMissionInUse = Strategic::where('mission_id', $foundation->foundation_id)
            ->where('status', '!=', 'deleted')
            ->exists();
        $isVisionInUse = Strategic::where('vision_id', $foundation->foundation_id)
            ->where('status', '!=', 'deleted')
            ->exists();
        $isCoreValueInUse = Link::where('core_value_id', $foundation->foundation_id)
            ->where('status', '!=', 'deleted')
            ->exists();

        if ($isMissionInUse || $isVisionInUse || $isCoreValueInUse) {
            throw ValidationException::withMessages([
                'foundation_id' => ['Foundations linked to active strategic plans or core values cannot be deleted.'],
            ]);
        }
    }
}
