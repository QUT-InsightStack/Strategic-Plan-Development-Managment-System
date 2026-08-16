<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\Link;
use App\Models\Strategic;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LinkService
{
    public function __construct(private readonly StrategicLogWriter $logWriter)
    {
    }

    public function getAll(array $filters = []): Collection
    {
        $query = Link::with(['coreValue', 'plan', 'creator', 'updater'])
            ->where('status', '!=', 'deleted');

        if (! empty($filters['plan_id'])) {
            $query->where('plan_id', $filters['plan_id']);
        }

        if (! empty($filters['core_value_id'])) {
            $query->where('core_value_id', $filters['core_value_id']);
        }

        return $query->get();
    }

    public function getById(int $id): ?Model
    {
        return Link::with(['coreValue', 'plan', 'creator', 'updater'])
            ->where('status', '!=', 'deleted')
            ->find($id);
    }

    public function getByPlanId(int $planId): Collection
    {
        return Link::with(['coreValue', 'creator', 'updater'])
            ->where('plan_id', $planId)
            ->where('status', '!=', 'deleted')
            ->get();
    }

    public function create(array $data): Model
    {
        $plan = Strategic::findOrFail($data['plan_id']);
        $this->ensurePlanCanBeChanged($plan);

        $existing = Link::where('core_value_id', $data['core_value_id'])
            ->where('plan_id', $data['plan_id'])
            ->first();

        if ($existing && $existing->status !== 'deleted') {
            throw ValidationException::withMessages([
                'core_value_id' => ['This plan core value relationship already exists.'],
            ]);
        }

        if ($existing) {
            $existing->update([
                'created_by' => $data['created_by'],
                'updated_by' => $data['updated_by'],
                'status' => 'active',
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => null,
            ]);

            $this->logWriter->write('plan_core_value.restored', [
                'link_id' => $existing->link_id,
                'plan_id' => $existing->plan_id,
            ]);

            return $existing->load(['coreValue', 'plan', 'creator', 'updater']);
        }

        $link = Link::create($data + [
            'status' => 'active',
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => null,
        ]);

        $this->logWriter->write('plan_core_value.created', [
            'link_id' => $link->link_id,
            'plan_id' => $link->plan_id,
        ]);

        return $link->load(['coreValue', 'plan', 'creator', 'updater']);
    }

    public function update(int $id, array $data): ?Model
    {
        $link = Link::where('status', '!=', 'deleted')->find($id);

        if (! $link) {
            return null;
        }

        $planId = $data['plan_id'] ?? $link->plan_id;
        $plan = Strategic::findOrFail($planId);
        $this->ensurePlanCanBeChanged($plan);

        $coreValueId = $data['core_value_id'] ?? $link->core_value_id;
        $existing = Link::where('core_value_id', $coreValueId)
            ->where('plan_id', $planId)
            ->where('link_id', '!=', $id)
            ->first();

        if ($existing && $existing->status !== 'deleted') {
            throw ValidationException::withMessages([
                'core_value_id' => ['This plan core value relationship already exists.'],
            ]);
        }

        if ($existing) {
            $this->softDelete($link, $data['updated_by'] ?? $link->updated_by ?? $link->created_by);

            $existing->update([
                'created_by' => $data['created_by'] ?? $existing->created_by,
                'updated_by' => $data['updated_by'] ?? $existing->updated_by,
                'status' => 'active',
                'archived_at' => null,
                'archived_by' => null,
                'deleted_at' => null,
            ]);

            $this->logWriter->write('plan_core_value.restored', [
                'link_id' => $existing->link_id,
                'plan_id' => $existing->plan_id,
            ]);

            return $existing->load(['coreValue', 'plan', 'creator', 'updater']);
        }

        $link->update($data);

        $this->logWriter->write('plan_core_value.updated', [
            'link_id' => $link->link_id,
            'plan_id' => $link->plan_id,
        ]);

        return $link->load(['coreValue', 'plan', 'creator', 'updater']);
    }

    public function delete(int $id): bool
    {
        $link = Link::where('status', '!=', 'deleted')->find($id);

        if (! $link) {
            return false;
        }

        $plan = Strategic::findOrFail($link->plan_id);
        $this->ensurePlanCanBeChanged($plan);
        $this->softDelete($link, auth('api')->id() ?? $link->updated_by ?? $link->created_by);

        $this->logWriter->write('plan_core_value.deleted', [
            'link_id' => $link->link_id,
            'plan_id' => $link->plan_id,
        ]);

        return true;
    }

    public function syncCoreValues(int $planId, array $coreValueIds, int $createdBy, int $updatedBy): Collection
    {
        return DB::transaction(function () use ($planId, $coreValueIds, $createdBy, $updatedBy) {
            $plan = Strategic::findOrFail($planId);
            $this->ensurePlanCanBeChanged($plan);

            $existingLinks = Link::where('plan_id', $planId)
                ->where('status', '!=', 'deleted')
                ->get();

            foreach ($existingLinks as $link) {
                $this->softDelete($link, $updatedBy);
            }

            foreach ($coreValueIds as $coreValueId) {
                $existing = Link::where('core_value_id', $coreValueId)
                    ->where('plan_id', $planId)
                    ->first();

                if ($existing) {
                    $existing->update([
                        'created_by' => $createdBy,
                        'updated_by' => $updatedBy,
                        'status' => 'active',
                        'archived_at' => null,
                        'archived_by' => null,
                        'deleted_at' => null,
                    ]);

                    continue;
                }

                Link::create([
                    'core_value_id' => $coreValueId,
                    'plan_id' => $planId,
                    'created_by' => $createdBy,
                    'updated_by' => $updatedBy,
                    'status' => 'active',
                    'archived_at' => null,
                    'archived_by' => null,
                    'deleted_at' => null,
                ]);
            }

            $this->logWriter->write('plan_core_value.synced', [
                'plan_id' => $planId,
                'count' => count($coreValueIds),
            ]);

            return $this->getByPlanId($planId);
        });
    }

    private function ensurePlanCanBeChanged(Strategic $plan): void
    {
        if ($plan->status === 'archived') {
            throw ValidationException::withMessages([
                'plan_id' => ['Archived strategic plans must be restored before their core values can be changed.'],
            ]);
        }

        if ($plan->status === 'deleted') {
            throw ValidationException::withMessages([
                'plan_id' => ['Deleted strategic plans cannot be changed.'],
            ]);
        }
    }

    private function softDelete(Link $link, ?int $userId): void
    {
        $link->update([
            'updated_by' => $userId,
            'status' => 'deleted',
            'archived_at' => null,
            'archived_by' => null,
            'deleted_at' => now(),
        ]);
    }
}
