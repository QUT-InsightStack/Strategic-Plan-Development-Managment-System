<?php

namespace App\Services;

use App\Models\Link;
use App\Models\Strategic;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LinkService
{
    public function getAll(array $filters = []): Collection
    {
        $query = Link::with(['coreValue', 'plan', 'creator', 'updater']);

        if (!empty($filters['plan_id'])) {
            $query->where('plan_id', $filters['plan_id']);
        }

        if (!empty($filters['core_value_id'])) {
            $query->where('core_value_id', $filters['core_value_id']);
        }

        return $query->get();
    }

    public function getById(int $id): ?Model
    {
        return Link::with(['coreValue', 'plan', 'creator', 'updater'])->find($id);
    }

    public function getByPlanId(int $planId): Collection
    {
        return Link::with(['coreValue', 'creator', 'updater'])
            ->where('plan_id', $planId)
            ->get();
    }

    public function create(array $data): Model
    {
        $this->ensureUnique($data['core_value_id'], $data['plan_id']);

        return Link::create($data)->load(['coreValue', 'plan', 'creator', 'updater']);
    }

    public function update(int $id, array $data): ?Model
    {
        $link = Link::find($id);

        if (!$link) {
            return null;
        }

        $coreValueId = $data['core_value_id'] ?? $link->core_value_id;
        $planId = $data['plan_id'] ?? $link->plan_id;

        $this->ensureUnique($coreValueId, $planId, $id);

        $link->update($data);

        return $link->load(['coreValue', 'plan', 'creator', 'updater']);
    }

    public function delete(int $id): bool
    {
        $link = Link::find($id);

        return $link ? (bool) $link->delete() : false;
    }

    public function syncCoreValues(int $planId, array $coreValueIds, int $createdBy, int $updatedBy): Collection
    {
        return DB::transaction(function () use ($planId, $coreValueIds, $createdBy, $updatedBy) {
            $plan = Strategic::findOrFail($planId);

            $syncData = [];
            foreach ($coreValueIds as $coreValueId) {
                $syncData[$coreValueId] = [
                    'created_by' => $createdBy,
                    'updated_by' => $updatedBy,
                ];
            }

            $plan->coreValues()->sync($syncData);

            return $this->getByPlanId($planId);
        });
    }

    protected function ensureUnique(int $coreValueId, int $planId, ?int $ignoreId = null): void
    {
        $query = Link::where('core_value_id', $coreValueId)
            ->where('plan_id', $planId);

        if ($ignoreId) {
            $query->where('link_id', '!=', $ignoreId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'core_value_id' => ['This plan core value relationship already exists.'],
            ]);
        }
    }
}
