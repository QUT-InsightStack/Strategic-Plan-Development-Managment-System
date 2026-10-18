<?php

namespace App\Repositories;

use App\Models\PresidentialAgendaItem;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class PresidentialAgendaItemRepository
{
    public function paginate(array $filters): LengthAwarePaginator
    {
        $status = $filters['status'] ?? 'active';
        $search = trim((string) ($filters['search'] ?? ''));

        return PresidentialAgendaItem::query()
            ->notDeleted()
            ->when(
                $status !== 'all',
                fn ($query) => $query->where('status', $status)
            )
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($builder) use ($search): void {
                    $builder->where('code', 'like', "%{$search}%")
                        ->orWhere('title', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->orderBy('title')
            ->orderBy('agenda_id')
            ->paginate($filters['per_page'] ?? 10);
    }

    public function findVisibleOrFail(int $id): PresidentialAgendaItem
    {
        return PresidentialAgendaItem::query()
            ->notDeleted()
            ->findOrFail($id);
    }

    public function lockForUpdateOrFail(int $id): PresidentialAgendaItem
    {
        return PresidentialAgendaItem::query()
            ->lockForUpdate()
            ->findOrFail($id);
    }
}