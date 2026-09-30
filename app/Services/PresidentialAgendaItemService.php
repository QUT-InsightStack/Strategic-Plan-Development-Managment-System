<?php

namespace App\Services;

use App\Contracts\StrategicLogWriter;
use App\Models\PresidentialAgendaItem;
use App\Repositories\PresidentialAgendaItemRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PresidentialAgendaItemService
{
    public function __construct(
        private readonly PresidentialAgendaItemRepository $items,
        private readonly StrategicLogWriter $auditWriter,
    ) {}

    public function create(array $data, int $actorId): PresidentialAgendaItem
    {
        return DB::transaction(function () use ($data, $actorId): PresidentialAgendaItem {
            $item = PresidentialAgendaItem::create([
                ...$data,
                'created_by' => $actorId,
            ]);

            $this->auditWriter->write('presidential_agenda.created', [
                'actor_user_id' => $actorId,
                'resource_type' => 'presidential_agenda_item',
                'resource_id' => $item->agenda_id,
                'to' => $item->status,
            ]);

            return $item;
        }, 3);
    }

    public function update(
        int $id,
        array $data,
        int $actorId
    ): PresidentialAgendaItem {
        return DB::transaction(function () use ($id, $data, $actorId): PresidentialAgendaItem {
            $item = $this->items->lockForUpdateOrFail($id);

            if ($item->status === 'deleted') {
                abort(404, 'Presidential Agenda item not found.');
            }

            if ($item->status === 'archived') {
                throw ValidationException::withMessages([
                    'status' => ['Archived Presidential Agenda items cannot be edited.'],
                ]);
            }

            $item->fill($data);

            if (! $item->isDirty()) {
                return $item;
            }

            // Record which fields changed, without putting the description
            // or other user-provided content into audit metadata.
            $changedFields = array_keys($item->getDirty());

            $item->updated_by = $actorId;
            $item->save();

            $this->auditWriter->write('presidential_agenda.updated', [
                'actor_user_id' => $actorId,
                'resource_type' => 'presidential_agenda_item',
                'resource_id' => $item->agenda_id,
                'changed_fields' => $changedFields,
            ]);

            return $item->refresh();
        }, 3);
    }

    public function archive(int $id, int $actorId): PresidentialAgendaItem
    {
        return DB::transaction(function () use ($id, $actorId): PresidentialAgendaItem {
            $item = $this->items->lockForUpdateOrFail($id);

            if ($item->status === 'deleted') {
                throw ValidationException::withMessages([
                    'status' => ['A deleted Presidential Agenda item cannot be archived.'],
                ]);
            }

            if ($item->status === 'archived') {
                throw ValidationException::withMessages([
                    'status' => ['Presidential Agenda item is already archived.'],
                ]);
            }

            $previousStatus = $item->status;

            $item->status = 'archived';
            $item->archived_at = now();
            $item->archived_by = $actorId;
            $item->updated_by = $actorId;
            $item->save();

            $this->auditWriter->write('presidential_agenda.archived', [
                'actor_user_id' => $actorId,
                'resource_type' => 'presidential_agenda_item',
                'resource_id' => $item->agenda_id,
                'from' => $previousStatus,
                'to' => 'archived',
            ]);

            return $item->refresh();
        }, 3);
    }

    public function delete(int $id, int $actorId): PresidentialAgendaItem
    {
        return DB::transaction(function () use ($id, $actorId): PresidentialAgendaItem {
            $item = $this->items->lockForUpdateOrFail($id);

            if ($item->status === 'deleted') {
                throw ValidationException::withMessages([
                    'status' => ['This Presidential Agenda item has already been deleted.'],
                ]);
            }

            if ($item->status !== 'archived') {
                throw ValidationException::withMessages([
                    'status' => ['Only archived Presidential Agenda items can be deleted.'],
                ]);
            }

            $item->status = 'deleted';
            $item->deleted_at = now();
            $item->deleted_by = $actorId;
            $item->updated_by = $actorId;
            $item->save();

            // Neither the agenda row nor its historical alignment pivots
            // are physically deleted.
            $this->auditWriter->write('presidential_agenda.deleted', [
                'actor_user_id' => $actorId,
                'resource_type' => 'presidential_agenda_item',
                'resource_id' => $item->agenda_id,
                'from' => 'archived',
                'to' => 'deleted',
            ]);

            return $item->refresh();
        }, 3);
    }
}