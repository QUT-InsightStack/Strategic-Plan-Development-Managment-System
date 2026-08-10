<?php

namespace App\Services;

use App\Models\Strategic;
use App\Models\StrategicFoundations;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;

class PlanCreationService
{
    public function paginate(array $filters): LengthAwarePaginator
    {
        $query = Strategic::with(['creator', 'missionFoundation', 'visionFoundation', 'coreValues']);

        if (!empty($filters['search'])) {
            $query->where('title', 'like', '%' . $filters['search'] . '%');
        }
        if (!empty($filters['level'])) {
            $query->where('level', $filters['level']);
        }
        if (!empty($filters['year'])) {
            $query->whereYear('updated_at', $filters['year']);
        }
        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return $query->orderByDesc('updated_at')->paginate($filters['per_page'] ?? 10);
    }

    public function find(int $id): ?Strategic
    {
        return Strategic::with(['creator', 'missionFoundation', 'visionFoundation', 'coreValues'])->find($id);
    }

    public function create(array $data, User $user): Strategic
    {
        return DB::transaction(function () use ($data, $user) {
            $foundationData = [
                'created_by' => $user->user_id,
                'version' => '1.0',
            ];

            $mission = StrategicFoundations::create($foundationData + [
                'type' => 'MISSION',
                'content' => $data['mission'] ?? '',
            ]);

            $vision = StrategicFoundations::create($foundationData + [
                'type' => 'VISION',
                'content' => $data['vision'] ?? '',
            ]);

            $plan = Strategic::create([
                'created_by' => $user->user_id,
                'level' => $data['level'],
                'title' => ($data['title'] ?? '') ?: 'Untitled Strategic Plan',
                'description' => $data['description'] ?? null,
                'status' => $data['status'] ?? 'draft',
                'mission_id' => $mission->foundation_id,
                'vision_id' => $vision->foundation_id,
            ]);

            $coreValueIds = collect($data['core_values'] ?? [])->map(function (string $content) use ($foundationData) {
                return StrategicFoundations::create($foundationData + [
                    'type' => 'CORE_VALUE',
                    'content' => $content,
                ])->foundation_id;
            });

            $syncData = $coreValueIds->mapWithKeys(fn (int $id) => [
                $id => ['created_by' => $user->user_id, 'updated_by' => $user->user_id],
            ])->all();

            $plan->coreValues()->sync($syncData);

            return $plan->load(['missionFoundation', 'visionFoundation', 'coreValues']);
        });
    }

    public function update(Strategic $plan, array $data, User $user): Strategic
    {
        return DB::transaction(function () use ($plan, $data, $user) {
            $plan->missionFoundation->update([
                'content' => $data['mission'] ?? '', 'updated_by' => $user->user_id, 'version' => '1.0',
            ]);
            $plan->visionFoundation->update([
                'content' => $data['vision'] ?? '', 'updated_by' => $user->user_id, 'version' => '1.0',
            ]);
            $plan->update([
                'updated_by' => $user->user_id,
                'level' => $data['level'],
                'title' => ($data['title'] ?? '') ?: 'Untitled Strategic Plan',
                'description' => $data['description'] ?? null,
                'status' => $data['status'] ?? $plan->status,
            ]);

            $oldCoreValueIds = $plan->coreValues()->pluck('tblstrategic_foundations.foundation_id');
            $newCoreValueIds = collect($data['core_values'] ?? [])->map(fn (string $content) => StrategicFoundations::create([
                'created_by' => $user->user_id,
                'type' => 'CORE_VALUE',
                'content' => $content,
                'version' => '1.0',
            ])->foundation_id);
            $plan->coreValues()->sync($newCoreValueIds->mapWithKeys(fn (int $id) => [
                $id => ['created_by' => $user->user_id, 'updated_by' => $user->user_id],
            ])->all());
            StrategicFoundations::whereIn('foundation_id', $oldCoreValueIds)->delete();

            return $this->find($plan->record_id);
        });
    }

    public function delete(Strategic $plan): void
    {
        DB::transaction(function () use ($plan) {
            $foundationIds = collect([$plan->mission_id, $plan->vision_id])
                ->merge($plan->coreValues()->pluck('tblstrategic_foundations.foundation_id'));
            $plan->delete();
            StrategicFoundations::whereIn('foundation_id', $foundationIds)->delete();
        });
    }

    public function copy(Strategic $source, User $user): Strategic
    {
        $source->loadMissing(['missionFoundation', 'visionFoundation', 'coreValues']);

        return $this->create([
            'title' => Str::limit($source->title . ' (Copy)', 255, ''),
            'level' => $source->level,
            'description' => $source->description,
            'mission' => $source->missionFoundation?->content ?? '',
            'vision' => $source->visionFoundation?->content ?? '',
            'core_values' => $source->coreValues->pluck('content')->all(),
            'status' => 'draft',
        ], $user);
    }

    public function updateStatus(Strategic $plan, string $status, User $user): Strategic
    {
        $plan->update(['status' => $status, 'updated_by' => $user->user_id]);

        return $this->find($plan->record_id);
    }
}
